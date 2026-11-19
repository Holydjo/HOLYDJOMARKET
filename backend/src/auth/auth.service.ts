import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Notifier } from '../mail/notifier';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateMeDto } from './dto/auth.dto';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Login protection (audit H2): only FAILED attempts count, so people sharing a
 * Wi-Fi (salon, office, family) are never blocked by each other's successful logins.
 */
const FAILURE_WINDOW_MS = 15 * 60_000;
const MAX_FAILURES_PER_ACCOUNT = 5;
const MAX_FAILURES_PER_IP = 30;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private notify: Notifier,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Cet email est déjà utilisé');
    }
    const { acceptTerms: _accepted, ...data } = dto;
    const user = await this.prisma.user.create({
      data: { ...data, email, password: await bcrypt.hash(dto.password, 10), termsAcceptedAt: new Date() },
    });
    // Welcome email = "confirm your address" link (audit H4).
    await this.sendVerification(user);
    return this.session(user);
  }

  async login(dto: LoginDto, ip = 'unknown') {
    const email = dto.email.toLowerCase().trim();
    const since = new Date(Date.now() - FAILURE_WINDOW_MS);
    const [byAccount, byIp] = await Promise.all([
      this.prisma.loginFailure.count({ where: { email, createdAt: { gte: since } } }),
      this.prisma.loginFailure.count({ where: { ip, createdAt: { gte: since } } }),
    ]);
    if (byAccount >= MAX_FAILURES_PER_ACCOUNT || byIp >= MAX_FAILURES_PER_IP) {
      throw new HttpException(
        'Trop de tentatives incorrectes. Patientez 15 minutes ou utilisez « Mot de passe oublié ».',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    // Same message for "unknown email" and "wrong password" so we don't leak which emails exist.
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      await this.prisma.loginFailure.create({ data: { email, ip } });
      if (Math.random() < 0.05) {
        // housekeeping: forget failures older than a day
        await this.prisma.loginFailure.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86400_000) } } });
      }
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    // Success clears this account's counter.
    await this.prisma.loginFailure.deleteMany({ where: { email } });
    return this.session(user);
  }

  /**
   * "Forgot password": emails a one-time link valid for 1 hour.
   * Always answers the same way, whether the email exists or not, so the form
   * can't be used to discover who has an account.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      await this.prisma.$transaction([
        // Only the newest link works.
        this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
        this.prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
        }),
      ]);
      this.notify.passwordReset(user, token);
    }
    return { message: 'Si un compte existe avec cet email, un lien de réinitialisation vient d’être envoyé.' };
  }

  /** Sets the new password, burns the token and logs out every other session. */
  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(dto.token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Ce lien n’est plus valide. Faites une nouvelle demande.');
    }
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        // The reset link reached the mailbox, which also proves the address (audit H4).
        data: { password: await bcrypt.hash(dto.password, 10), passwordChangedAt: new Date(), emailVerifiedAt: new Date() },
      }),
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    return this.session(user);
  }

  /**
   * "Devenir prestataire" for someone who already has a customer account:
   * same email and password, past bookings kept. Returns a fresh token so the
   * new role takes effect immediately. Admin accounts can't switch.
   */
  async becomeProvider(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.role === 'ADMIN') throw new BadRequestException('Un compte administrateur ne peut pas devenir prestataire');
    const updated =
      user.role === 'PROVIDER' ? user : await this.prisma.user.update({ where: { id: userId }, data: { role: 'PROVIDER' } });
    return this.session(updated);
  }

  // ------------------------------------------------------------ email verification

  /** Creates a fresh one-time link (older ones stop working) and emails it. */
  private async sendVerification(user: User) {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.emailVerificationToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
      }),
    ]);
    this.notify.verifyEmail(user, token);
  }

  /** "Renvoyer le lien" from the banner shown to unverified users. */
  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.emailVerifiedAt) return { message: 'Votre adresse est déjà confirmée.' };
    await this.sendVerification(user);
    return { message: `Nouveau lien envoyé à ${user.email}. Pensez à vérifier vos courriels indésirables.` };
  }

  /** Link from the email → confirms the address and logs the user in. */
  async verifyEmail(token: string) {
    const row = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Ce lien de confirmation n’est plus valide. Connectez-vous et demandez un nouveau lien.');
    }
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
      this.prisma.emailVerificationToken.deleteMany({ where: { userId: row.userId } }),
    ]);
    return this.session(user);
  }

  // ------------------------------------------------------------ Mon compte

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: dto });
    return this.publicUser(user);
  }

  /** Requires the current password; signs out the other sessions and returns a fresh token for this one. */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(dto.newPassword, 10), passwordChangedAt: new Date() },
    });
    return this.session(updated);
  }

  /**
   * Deletes the account and everything attached (provider profile, services,
   * photos, opening hours, bookings, reviews) — Loi 25 right to erasure.
   * Admin accounts are removed by another admin, never by themselves, so the
   * site can't end up without an administrator.
   */
  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!(await bcrypt.compare(password, user.password))) throw new BadRequestException('Mot de passe incorrect');
    if (user.role === 'ADMIN') throw new BadRequestException('Un compte administrateur ne peut pas se supprimer lui-même.');
    await deleteUserAndRefreshRatings(this.prisma, userId);
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.publicUser(user);
  }

  /** Token + safe user object returned to the frontend after login/register. */
  private session(user: User) {
    const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return { token, user: this.publicUser(user) };
  }

  private publicUser(u: User) {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      role: u.role,
      emailVerified: !!u.emailVerifiedAt,
    };
  }
}

/**
 * Deletes a user (cascade does the rest) and recomputes the rating of every
 * provider they had reviewed. Shared with the admin "delete account" action.
 */
export async function deleteUserAndRefreshRatings(prisma: PrismaService, userId: string) {
  const reviewed = await prisma.review.findMany({ where: { authorId: userId }, select: { profileId: true } });
  await prisma.user.delete({ where: { id: userId } });
  for (const profileId of new Set(reviewed.map((r) => r.profileId))) {
    await refreshRating(prisma, profileId);
  }
}

/** Recomputes the denormalised rating of a profile from its reviews. */
export async function refreshRating(prisma: PrismaService, profileId: string) {
  const agg = await prisma.review.aggregate({ where: { profileId }, _avg: { rating: true }, _count: true });
  await prisma.providerProfile.updateMany({
    where: { id: profileId },
    data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
  });
}
