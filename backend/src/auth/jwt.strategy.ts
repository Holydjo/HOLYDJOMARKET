import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../common/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Whatever is returned here becomes `req.user`.
   * We re-read the user so that deleted accounts, role changes and
   * password resets take effect immediately (old tokens stop working).
   */
  async validate(payload: AuthUser & { iat: number }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, passwordChangedAt: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
      throw new UnauthorizedException('Session expirée, reconnectez-vous');
    }
    return { sub: user.id, email: user.email, role: user.role };
  }
}
