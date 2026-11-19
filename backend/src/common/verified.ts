import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Audit H4: actions that reach other people (booking, publishing a profile,
 * reviewing, reporting, proposing a category) need a confirmed email address.
 * The website shows a banner with "Renvoyer le lien" to unverified users.
 */
export async function assertEmailVerified(prisma: PrismaService, userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true, email: true } });
  if (!u?.emailVerifiedAt) {
    throw new ForbiddenException(
      `Confirmez d’abord votre adresse email : cliquez sur le lien envoyé à ${u?.email ?? 'votre adresse'}. ` +
        'Pas reçu ? Utilisez « Renvoyer le lien » en haut de la page.',
    );
  }
}
