import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';

/** Shape of `req.user` after the JWT strategy validated the token. */
export class AuthUser {
  declare sub: string;
  declare email: string;
  declare role: Role;
}

/** Rejects requests without a valid Bearer token. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

/**
 * Lets anonymous requests through but still decodes the token when present.
 * Used on public pages that show extra info to logged-in users.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest(_err: unknown, user: any) {
    return user ?? null;
  }
}

/** @Roles('ADMIN') — combine with JwtAuthGuard + RolesGuard. */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Accès refusé');
    }
    return true;
  }
}

/** @CurrentUser() user: AuthUser — shortcut for req.user. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | null =>
    ctx.switchToHttp().getRequest().user ?? null,
);
