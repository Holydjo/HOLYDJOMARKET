import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface Email {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends transactional emails over SMTP (works with Resend, Brevo, SendGrid,
 * Mailgun, Gmail… — anything that gives you an SMTP URL).
 *
 *   SMTP_URL="smtps://USER:PASSWORD@smtp.example.com:465"
 *   MAIL_FROM="HOLYDJO MARKET <bonjour@your-domain.com>"
 *
 * Without SMTP_URL (local dev) emails are printed in the API console instead,
 * so every flow can be tested without an email account.
 *
 * Sending never blocks or breaks the HTTP request that triggered it: callers
 * use `queue()`, and failures are only logged.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('SMTP_URL');
    this.transport = url ? createTransport(url) : null;
    this.from = config.get('MAIL_FROM', 'HOLYDJO MARKET <no-reply@holydo.test>');
    if (!this.transport) this.log.warn('SMTP_URL not set — emails will be printed to the console');
  }

  /** Fire-and-forget: returns immediately, logs failures. */
  queue(email: Email) {
    void this.send(email).catch((e) => this.log.error(`Failed to send "${email.subject}": ${e.message}`));
  }

  async send(email: Email) {
    const to = [email.to].flat().filter(Boolean);
    if (!to.length) return;
    if (!this.transport) {
      this.log.log(`\n✉️  To: ${to.join(', ')}\n   Subject: ${email.subject}\n   ${email.text.replace(/\n/g, '\n   ')}\n`);
      return;
    }
    await this.transport.sendMail({ from: this.from, to, subject: email.subject, html: email.html, text: email.text });
  }
}
