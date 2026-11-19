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
 *   account created                the new user (welcome + "confirm your email" link)
 *   password reset requested       the user
 *   appointment requested          provider
 *   appointment accepted/declined  customer
 *   appointment cancelled          provider
 *   profile submitted for review   all admins
 *   new category proposed          all admins
 *   profile / review reported      all admins
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

  verifyEmail(user: { email: string; firstName: string; role: string }, token: string) {
    const isPro = user.role === 'PROVIDER';
    this.send(user.email, 'Bienvenue sur HOLYDJO MARKET — confirmez votre adresse', {
      heading: `Bienvenue ${user.firstName} !`,
      lines: [
        'Pour activer votre compte, confirmez votre adresse email en cliquant sur le bouton ci-dessous (lien valable 48 h).',
        isPro
          ? 'Ensuite, complétez votre profil (services, photos, horaires) et soumettez-le : notre équipe le vérifie en général sous 48 h.'
          : 'Ensuite, vous pourrez envoyer vos demandes de rendez-vous aux pros de votre quartier.',
        'Vous n’avez pas créé de compte ? Ignorez simplement ce message.',
      ],
      cta: { label: 'Confirmer mon adresse', url: `${this.appUrl}/verifier-email?token=${encodeURIComponent(token)}` },
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
        ['Date souhaitée', fmtDate(a.requestedAt, a.profile.timeZone)],
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
        ['Date', fmtDate(a.requestedAt, a.profile.timeZone)],
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
      details: [['Date prévue', fmtDate(a.requestedAt, a.profile.timeZone)]],
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

  async categoryProposed(categoryId: string) {
    const [c, admins] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: categoryId }, include: { proposedBy: { include: { providerProfile: true } } } }),
      this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } }),
    ]);
    if (!c || !admins.length) return;
    const who = c.proposedBy?.providerProfile?.displayName ?? c.proposedBy?.firstName ?? 'Un prestataire';
    this.send(admins.map((a) => a.email), `Nouvelle catégorie proposée : ${c.name}`, {
      heading: 'Une catégorie attend votre validation',
      lines: [
        `${who} a proposé la catégorie « ${c.name} ».`,
        'Approuvez-la (vous pouvez corriger son nom et son icône) pour l’afficher publiquement, ou fusionnez-la avec une catégorie existante.',
      ],
      cta: { label: 'Ouvrir la modération', url: `${this.appUrl}/admin` },
    });
  }

  async reportCreated(reportId: string) {
    const [r, admins] = await Promise.all([
      this.prisma.report.findUnique({ where: { id: reportId } }),
      this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } }),
    ]);
    if (!r || !admins.length) return;
    const target =
      r.targetType === 'PROFILE'
        ? (await this.prisma.providerProfile.findUnique({ where: { id: r.targetId }, select: { displayName: true } }))?.displayName
        : 'un avis';
    this.send(admins.map((a) => a.email), `Signalement : ${target ?? 'élément'}`, {
      heading: 'Un élément a été signalé',
      lines: [`${r.targetType === 'PROFILE' ? 'Le profil' : 'Un avis'} ${r.targetType === 'PROFILE' ? `« ${target} »` : ''} a été signalé (raison : ${REASON_FR[r.reason] ?? r.reason}).`],
      quote: r.message ?? undefined,
      cta: { label: 'Voir les signalements', url: `${this.appUrl}/admin` },
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

  /**
   * Admin diagnostic: sends a test email *synchronously* and reports what
   * happened, with an explanation of the most common SMTP problems.
   */
  async testEmail(to: string) {
    const info = this.mail.info();
    if (info.mode === 'console') {
      return {
        ok: false,
        ...info,
        problem: 'SMTP_URL n’est pas configuré sur le serveur : les emails sont seulement écrits dans les journaux (Logs) de l’API, aucun n’est envoyé.',
        fix: 'Dans Render → holydo-api → Environment, ajoutez SMTP_URL (ex. smtps://resend:VOTRE_CLE_API@smtp.resend.com:465) et MAIL_FROM, puis enregistrez.',
      };
    }
    try {
      await this.mail.send({
        to,
        subject: 'Test d’envoi — HOLYDJO MARKET',
        ...render({
          heading: 'Les emails fonctionnent ✅',
          lines: ['Si vous lisez ce message, HOLYDJO MARKET peut envoyer des emails depuis votre serveur.', `Expéditeur utilisé : ${info.from}`],
          cta: { label: 'Ouvrir la modération', url: `${this.appUrl}/admin` },
        }),
      });
      return { ok: true, ...info, to, problem: null, fix: 'Vérifiez votre boîte de réception, et le dossier Courrier indésirable / Spam.' };
    } catch (e) {
      const message = (e as Error).message ?? String(e);
      return { ok: false, ...info, to, problem: message, fix: explainSmtpError(message) };
    }
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

/** Plain-language hints for the errors SMTP providers (Resend first) usually return. */
function explainSmtpError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('testing emails') || m.includes('own email') || m.includes('verify a domain'))
    return 'Resend est en mode test : avec l’expéditeur onboarding@resend.dev, il n’envoie qu’à l’adresse email de votre compte Resend. Utilisez cette adresse pour votre compte admin, ou vérifiez votre propre domaine dans Resend (Domains) et changez MAIL_FROM.';
  if (m.includes('domain') && (m.includes('not verified') || m.includes('verify')))
    return 'Le domaine de MAIL_FROM n’est pas vérifié chez votre fournisseur d’emails. Vérifiez-le (Resend → Domains) ou utilisez onboarding@resend.dev pour tester.';
  if (m.includes('invalid login') || m.includes('auth') || m.includes('535') || m.includes('api key'))
    return 'Identifiants SMTP refusés : la clé API dans SMTP_URL est fausse ou supprimée. Format Resend : smtps://resend:VOTRE_CLE_API@smtp.resend.com:465';
  if (m.includes('from') && (m.includes('invalid') || m.includes('format')))
    return 'MAIL_FROM est mal formé. Exemple valide : HOLYDJO MARKET <onboarding@resend.dev>';
  if (m.includes('enotfound') || m.includes('econnrefused') || m.includes('timeout') || m.includes('etimedout'))
    return 'Impossible de joindre le serveur SMTP : vérifiez l’adresse et le port dans SMTP_URL (Resend : smtp.resend.com, port 465 avec smtps://).';
  return 'Vérifiez SMTP_URL et MAIL_FROM dans Render → holydo-api → Environment. Le message ci-dessus vient directement du fournisseur d’emails.';
}

/** French labels for report reasons (same codes as the website). */
const REASON_FR: Record<string, string> = {
  fake: 'faux profil ou faux avis',
  offensive: 'contenu offensant',
  scam: 'arnaque ou demande de paiement suspecte',
  wrong_info: 'informations fausses',
  other: 'autre',
};
