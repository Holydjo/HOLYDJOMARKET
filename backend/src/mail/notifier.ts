import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { fmtDate, fmtMoney, render } from './templates';

/**
 * One method per event worth an email. Feature services call these after the
 * database change succeeded; every method looks up what it needs and queues
 * the email (never throws, never slows the request down).
 *
 *   Event                          Recipient
 *   ─────────────────────────────  ─────────────
 *   account created                the new user
 *   password reset requested       the user
 *   appointment requested          provider
 *   appointment accepted/declined  customer
 *   appointment cancelled          provider
 *   profile submitted for review   all admins
 *   profile approved / rejected    provider
 */
@Injectable()
export class Notifier {
  private readonly appUrl: string;

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    config: ConfigService,
  ) {
    this.appUrl = (config.get<string>('APP_URL') ?? 'http://localhost:4000').replace(/\/$/, '');
  }

  welcome(user: { email: string; firstName: string; role: string }) {
    const isPro = user.role === 'PROVIDER';
    this.send(user.email, 'Bienvenue sur HOLYDJO MARKET', {
      heading: `Bienvenue ${user.firstName} !`,
      lines: isPro
        ? [
            'Votre compte prestataire est créé.',
            'Complétez votre profil (services, photos, horaires) puis soumettez-le : notre équipe le vérifie en général sous 48 h avant sa publication.',
          ]
        : ['Votre compte est créé. Trouvez les pros de votre quartier et envoyez vos demandes de rendez-vous en quelques secondes.'],
      cta: isPro ? { label: 'Compléter mon profil', url: `${this.appUrl}/dashboard` } : { label: 'Trouver un pro', url: `${this.appUrl}/recherche` },
    });
  }

  passwordReset(user: { email: string; firstName: string }, token: string) {
    this.send(user.email, 'Réinitialiser votre mot de passe', {
      heading: 'Réinitialisation du mot de passe',
      lines: [
        `Bonjour ${user.firstName}, vous avez demandé à changer votre mot de passe HOLYDJO MARKET.`,
        'Ce lien est valable 1 heure et ne peut servir qu’une seule fois.',
        'Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet email : votre mot de passe reste inchangé.',
      ],
      cta: { label: 'Choisir un nouveau mot de passe', url: `${this.appUrl}/reinitialiser?token=${encodeURIComponent(token)}` },
    });
  }

  async appointmentRequested(appointmentId: string) {
    const a = await this.loadAppointment(appointmentId);
    if (!a) return;
    this.send(a.profile.user.email, `Nouvelle demande de rendez-vous — ${a.customer.firstName}`, {
      heading: 'Vous avez une nouvelle demande de rendez-vous',
      lines: [`${a.customer.firstName} ${a.customer.lastName[0]}. souhaite prendre rendez-vous avec ${a.profile.displayName}.`],
      quote: a.message ?? undefined,
      details: [
        ['Date souhaitée', fmtDate(a.requestedAt)],
        ['Service', a.service ? `${a.service.name} (${fmtMoney(a.service.priceCents)})` : 'À préciser'],
        ...(a.location ? ([['Adresse', a.location]] as [string, string][]) : []),
      ],
      cta: { label: 'Répondre à la demande', url: `${this.appUrl}/dashboard` },
    });
  }

  async appointmentAnswered(appointmentId: string) {
    const a = await this.loadAppointment(appointmentId);
    if (!a || (a.status !== 'ACCEPTED' && a.status !== 'DECLINED')) return;
    const ok = a.status === 'ACCEPTED';
    this.send(a.customer.email, ok ? `${a.profile.displayName} a accepté votre demande` : `Réponse de ${a.profile.displayName}`, {
      heading: ok ? 'Votre rendez-vous est confirmé 🎉' : 'Votre demande n’a pas pu être acceptée',
      lines: ok
        ? [`${a.profile.displayName} a accepté votre demande.`, 'Vous pouvez le ou la contacter directement pour les derniers détails.']
        : [`${a.profile.displayName} n’est pas disponible pour ce créneau.`, 'Vous pouvez proposer une autre date ou trouver un autre pro près de chez vous.'],
      quote: a.providerNote ?? undefined,
      details: [
        ['Date', fmtDate(a.requestedAt)],
        ...(a.service ? ([['Service', a.service.name]] as [string, string][]) : []),
        ...(ok && a.profile.phone ? ([['Téléphone', a.profile.phone]] as [string, string][]) : []),
        // Home-based providers' address is only revealed once the appointment is confirmed.
        ...(ok && a.profile.address && !a.location
          ? ([['Adresse', [a.profile.address, a.profile.city].join(', ')]] as [string, string][])
          : []),
      ],
      cta: ok ? { label: 'Voir mes demandes', url: `${this.appUrl}/compte` } : { label: 'Voir le profil', url: `${this.appUrl}/p/${a.profile.slug}` },
    });
  }

  async appointmentCancelled(appointmentId: string) {
    const a = await this.loadAppointment(appointmentId);
    if (!a) return;
    this.send(a.profile.user.email, `Demande annulée par ${a.customer.firstName}`, {
      heading: 'Une demande a été annulée',
      lines: [`${a.customer.firstName} ${a.customer.lastName[0]}. a annulé sa demande de rendez-vous.`],
      details: [['Date prévue', fmtDate(a.requestedAt)]],
      cta: { label: 'Voir mes demandes', url: `${this.appUrl}/dashboard` },
    });
  }

  async profileSubmitted(profileId: string) {
    const [p, admins] = await Promise.all([
      this.prisma.providerProfile.findUnique({ where: { id: profileId } }),
      this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } }),
    ]);
    if (!p || !admins.length) return;
    this.send(admins.map((a) => a.email), `À valider : ${p.displayName}`, {
      heading: 'Un profil attend votre validation',
      lines: [`${p.displayName} (${[p.neighbourhood, p.city].filter(Boolean).join(', ')}) a soumis son profil.`],
      cta: { label: 'Ouvrir la modération', url: `${this.appUrl}/admin` },
    });
  }

  async profileDecision(profileId: string) {
    const p = await this.prisma.providerProfile.findUnique({ where: { id: profileId }, include: { user: true } });
    if (!p || (p.status !== 'APPROVED' && p.status !== 'REJECTED')) return;
    const ok = p.status === 'APPROVED';
    this.send(p.user.email, ok ? 'Votre profil est en ligne 🎉' : 'Votre profil a besoin de quelques corrections', {
      heading: ok ? `${p.displayName} est maintenant visible` : 'Quelques corrections sont nécessaires',
      lines: ok
        ? ['Bonne nouvelle : notre équipe a validé votre profil. Les clients de votre quartier peuvent désormais vous trouver et vous envoyer des demandes.']
        : ['Notre équipe a relu votre profil et vous demande quelques ajustements avant publication. Modifiez-le puis soumettez-le à nouveau.'],
      quote: ok ? undefined : p.rejectionReason ?? undefined,
      cta: ok ? { label: 'Voir ma page publique', url: `${this.appUrl}/p/${p.slug}` } : { label: 'Modifier mon profil', url: `${this.appUrl}/dashboard` },
    });
  }

  // ---------------------------------------------------------------------------

  private send(to: string | string[], subject: string, block: Parameters<typeof render>[0]) {
    this.mail.queue({ to, subject, ...render(block) });
  }

  private loadAppointment(id: string) {
    return this.prisma.appointmentRequest.findUnique({
      where: { id },
      include: {
        service: true,
        customer: true,
        profile: { include: { user: { select: { email: true } } } },
      },
    });
  }
}
