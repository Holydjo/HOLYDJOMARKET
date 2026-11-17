import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Notifier } from '../mail/notifier';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
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
    this.notify.welcome(user);
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    // Same message for "unknown email" and "wrong password" so we don't leak which emails exist.
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
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
        data: { password: await bcrypt.hash(dto.password, 10), passwordChangedAt: new Date() },
      }),
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    return this.session(user);
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
    };
  }
}
