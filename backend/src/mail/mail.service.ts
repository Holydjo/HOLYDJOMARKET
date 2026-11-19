import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailStatus } from '@prisma/client';
import { createTransport, Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

export interface Email {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

/** Wait before retry n (1st retry after 1 min … last after 6 h). Then the email is marked FAILED. */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const WORKER_EVERY_MS = 20_000;
const BATCH = 10;

/**
 * Transactional emails over SMTP (Resend, Brevo, SendGrid… anything with an SMTP URL).
 *
 *   SMTP_URL="smtps://USER:PASSWORD@smtp.example.com:465"
 *   MAIL_FROM="HOLYDJO MARKET <bonjour@your-domain.com>"
 *
 * Reliability (outbox pattern):
 *   1. queue() stores the email in the EmailOutbox table — nothing else.
 *   2. A worker (every 20 s, and right after each queue()) claims due emails
 *      and sends them. Failures are retried with growing delays; after the
 *      last attempt the email is FAILED and visible in Modération → Emails,
 *      where an admin can retry it.
 *   3. If the server restarts mid-way (deploy on Render…), pending emails are
 *      simply picked up again on the next start.
 *
 * Without SMTP_URL (local dev) emails are printed in the console and marked SENT.
 */
@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Mail');
  private readonly transport: Transporter | null;
  private readonly from: string;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const url = config.get<string>('SMTP_URL');
    this.transport = url ? createTransport(url) : null;
    this.from = config.get('MAIL_FROM', 'HOLYDJO MARKET <no-reply@holydo.test>');
    if (!this.transport) this.log.warn('SMTP_URL not set — emails will be printed to the console');
  }

  onModuleInit() {
    this.timer = setInterval(() => void this.processQueue(), WORKER_EVERY_MS);
    void this.processQueue(); // send what was left pending before a restart
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** For the admin diagnostic: which mode is active and from which sender (never the password). */
  info() {
    return { mode: this.transport ? ('smtp' as const) : ('console' as const), from: this.from };
  }

  /** Store the email for sending; returns immediately. Never throws to the caller. */
  queue(email: Email) {
    const to = [email.to].flat().filter(Boolean);
    if (!to.length) return;
    void this.prisma.emailOutbox
      .create({ data: { to, subject: email.subject, html: email.html, text: email.text } })
      .then(() => setImmediate(() => void this.processQueue()))
      .catch((e: Error) => this.log.error(`Could not store email "${email.subject}": ${e.message}`));
  }

  /** Send now, bypassing the queue (used by the admin "test email" button to report errors live). */
  async send(email: Email) {
    const to = [email.to].flat().filter(Boolean);
    if (!to.length) return;
    await this.deliver(to, email);
  }

  // ---------------------------------------------------------------- worker

  async processQueue() {
    if (this.running) return; // one batch at a time per server
    this.running = true;
    try {
      // An email stuck in SENDING for 10 min means the server died mid-send: try it again.
      await this.prisma.emailOutbox.updateMany({
        where: { status: 'SENDING', nextAttemptAt: { lt: new Date(Date.now() - 10 * 60_000) } },
        data: { status: 'PENDING' },
      });

      const due = await this.prisma.emailOutbox.findMany({
        where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
        take: BATCH,
      });
      for (const e of due) {
        // Claim it (safe even if several servers run the worker).
        const claimed = await this.prisma.emailOutbox.updateMany({
          where: { id: e.id, status: 'PENDING' },
          data: { status: 'SENDING', nextAttemptAt: new Date() },
        });
        if (!claimed.count) continue;
        try {
          await this.deliver(e.to, e);
          await this.prisma.emailOutbox.update({
            where: { id: e.id },
            data: { status: 'SENT', sentAt: new Date(), attempts: e.attempts + 1, lastError: null },
          });
        } catch (err) {
          const attempts = e.attempts + 1;
          const failed = attempts >= MAX_ATTEMPTS;
          const message = ((err as Error).message ?? String(err)).slice(0, 500);
          await this.prisma.emailOutbox.update({
            where: { id: e.id },
            data: {
              attempts,
              lastError: message,
              status: failed ? 'FAILED' : 'PENDING',
              nextAttemptAt: new Date(Date.now() + (RETRY_DELAYS_MS[attempts - 1] ?? 0)),
            },
          });
          this.log.error(`${failed ? 'Gave up on' : 'Will retry'} "${e.subject}" (attempt ${attempts}): ${message}`);
        }
      }

      // Housekeeping: forget sent emails after 90 days.
      if (Math.random() < 0.02) {
        await this.prisma.emailOutbox.deleteMany({ where: { status: 'SENT', sentAt: { lt: new Date(Date.now() - 90 * 86400_000) } } });
      }
    } catch (e) {
      this.log.error(`Email worker error: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async deliver(to: string[], email: Pick<Email, 'subject' | 'html' | 'text'>) {
    if (!this.transport) {
      this.log.log(`\n✉️  To: ${to.join(', ')}\n   Subject: ${email.subject}\n   ${email.text.replace(/\n/g, '\n   ')}\n`);
      return;
    }
    await this.transport.sendMail({ from: this.from, to, subject: email.subject, html: email.html, text: email.text });
    this.log.log(`Sent "${email.subject}" to ${to.join(', ')}`);
  }

  // ---------------------------------------------------------------- admin

  async adminList(status?: EmailStatus) {
    const [items, grouped] = await Promise.all([
      this.prisma.emailOutbox.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, to: true, subject: true, status: true, attempts: true, lastError: true, nextAttemptAt: true, sentAt: true, createdAt: true },
      }),
      this.prisma.emailOutbox.groupBy({ by: ['status'], _count: true }),
    ]);
    return { counts: Object.fromEntries(grouped.map((g) => [g.status, g._count])), items, ...this.info() };
  }

  /** Put a FAILED (or PENDING) email back at the front of the queue. */
  async retry(id: string) {
    await this.prisma.emailOutbox.updateMany({
      where: { id, status: { in: ['FAILED', 'PENDING'] } },
      data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lastError: null },
    });
    void this.processQueue();
    return { ok: true };
  }
}
