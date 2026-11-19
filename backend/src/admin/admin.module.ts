import {
  BadRequestException,
  Delete,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppointmentStatus, EmailStatus, Prisma, ProfileStatus, Role } from '@prisma/client';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth.decorators';
import { deleteUserAndRefreshRatings, refreshRating } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { Notifier } from '../mail/notifier';
import { PrismaService } from '../prisma/prisma.service';

class RejectDto {
  @IsString()
  @MinLength(5, { message: 'Expliquez brièvement la raison (5 caractères min.)' })
  @MaxLength(500)
  reason: string;
}

/**
 * Admin moderation of provider profiles.
 *   PENDING ──approve──▶ APPROVED (visible in search)
 *   PENDING ──reject───▶ REJECTED (provider sees the reason, fixes, resubmits)
 *   APPROVED ──suspend─▶ REJECTED (to take a profile offline)
 * Every decision is written to ModerationLog.
 */
@Injectable()
class AdminService {
  constructor(
    private prisma: PrismaService,
    private notify: Notifier,
  ) {}

  async stats() {
    const grouped = await this.prisma.providerProfile.groupBy({ by: ['status'], _count: true });
    const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
    const [customers, appointments, pendingCategories, openReports, failedEmails] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.appointmentRequest.count(),
      this.prisma.category.count({ where: { status: 'PENDING' } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.emailOutbox.count({ where: { status: 'FAILED' } }),
    ]);
    return { byStatus, customers, appointments, pendingCategories, openReports, failedEmails };
  }

  list(status: ProfileStatus) {
    return this.prisma.providerProfile.findMany({
      where: { status },
      orderBy: status === 'PENDING' ? { submittedAt: 'asc' } : { updatedAt: 'desc' }, // oldest first = fair queue
      include: {
        user: { select: { email: true, firstName: true, lastName: true, phone: true, createdAt: true } },
        photos: { orderBy: [{ isCover: 'desc' }, { order: 'asc' }] },
        services: { include: { category: true } },
        openingHours: { orderBy: { weekday: 'asc' } },
        moderation: { orderBy: { createdAt: 'desc' }, take: 3, include: { admin: { select: { firstName: true } } } },
      },
    });
  }

  async decide(adminId: string, profileId: string, action: 'APPROVED' | 'REJECTED', reason?: string) {
    const p = await this.prisma.providerProfile.findUnique({ where: { id: profileId } });
    if (!p) throw new NotFoundException();
    // PENDING → approve; REJECTED → approve = reactivate a suspended / corrected profile.
    if (action === 'APPROVED' && p.status !== 'PENDING' && p.status !== 'REJECTED') {
      throw new BadRequestException('Seuls les profils en attente ou suspendus peuvent être approuvés');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.providerProfile.update({
        where: { id: profileId },
        data:
          action === 'APPROVED'
            ? { status: 'APPROVED', approvedAt: new Date(), rejectionReason: null }
            : { status: 'REJECTED', rejectionReason: reason },
      }),
      this.prisma.moderationLog.create({ data: { profileId, adminId, action, reason } }),
    ]);
    void this.notify.profileDecision(profileId).catch((e: Error) => console.error('[Mail]', e.message));
    return updated;
  }
}

/**
 * Day-to-day admin tools: users, reviews, appointments.
 * Kept separate from the moderation queue above to stay readable.
 */
@Injectable()
class AdminToolsService {
  constructor(private prisma: PrismaService) {}

  /** Search by name or email, optional role filter. 50 most recent. */
  users(q?: string, role?: Role) {
    const text = q?.trim();
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(text
        ? {
            OR: [
              { email: { contains: text, mode: 'insensitive' } },
              { firstName: { contains: text, mode: 'insensitive' } },
              { lastName: { contains: text, mode: 'insensitive' } },
              { providerProfile: { displayName: { contains: text, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true, role: true, createdAt: true,
        providerProfile: { select: { id: true, displayName: true, slug: true, status: true } },
        _count: { select: { appointments: true, reviews: true } },
      },
    });
  }

  /** Permanently deletes a customer or provider account (spam, fraud, request by email). */
  async deleteUser(adminId: string, userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException('Utilisateur introuvable');
    if (u.id === adminId) throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte ici');
    if (u.role === 'ADMIN') throw new BadRequestException('Un compte administrateur ne peut pas être supprimé depuis le site');
    await deleteUserAndRefreshRatings(this.prisma, userId);
    return { ok: true };
  }

  reviews(q?: string) {
    const text = q?.trim();
    return this.prisma.review.findMany({
      where: text
        ? {
            OR: [
              { comment: { contains: text, mode: 'insensitive' } },
              { profile: { displayName: { contains: text, mode: 'insensitive' } } },
              { author: { email: { contains: text, mode: 'insensitive' } } },
            ],
          }
        : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: { select: { firstName: true, lastName: true, email: true } },
        profile: { select: { displayName: true, slug: true } },
      },
    });
  }

  async deleteReview(id: string) {
    const r = await this.prisma.review.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Avis introuvable');
    await this.prisma.review.delete({ where: { id } });
    await refreshRating(this.prisma, r.profileId);
    return { ok: true };
  }

  appointments(status?: AppointmentStatus) {
    return this.prisma.appointmentRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        profile: { select: { displayName: true, slug: true, timeZone: true } },
        service: { select: { name: true, priceCents: true } },
      },
    });
  }
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
class AdminController {
  constructor(
    private svc: AdminService,
    private tools: AdminToolsService,
    private notify: Notifier,
    private mail: MailService,
  ) {}

  // ---- users -----------------------------------------------------------
  /** GET /admin/users?q=marie&role=PROVIDER */
  @Get('users')
  users(@Query('q') q?: string, @Query('role') role?: Role) {
    if (role && !Object.values(Role).includes(role)) throw new BadRequestException('Rôle invalide');
    return this.tools.users(q, role);
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.tools.deleteUser(u.sub, id);
  }

  // ---- reviews ---------------------------------------------------------
  @Get('reviews')
  reviews(@Query('q') q?: string) {
    return this.tools.reviews(q);
  }

  @Delete('reviews/:id')
  deleteReview(@Param('id') id: string) {
    return this.tools.deleteReview(id);
  }

  // ---- appointments ----------------------------------------------------
  @Get('appointments')
  appointments(@Query('status') status?: AppointmentStatus) {
    if (status && !Object.values(AppointmentStatus).includes(status)) throw new BadRequestException('Statut invalide');
    return this.tools.appointments(status);
  }

  /** Email journal: last 100 emails + counts per status. GET /admin/emails?status=FAILED */
  @Get('emails')
  emails(@Query('status') status?: EmailStatus) {
    if (status && !Object.values(EmailStatus).includes(status)) throw new BadRequestException('Statut invalide');
    return this.mail.adminList(status);
  }

  @Post('emails/:id/retry')
  retryEmail(@Param('id') id: string) {
    return this.mail.retry(id);
  }

  /** Sends a test email to the logged-in admin and explains any failure. */
  @Post('test-email')
  testEmail(@CurrentUser() u: AuthUser) {
    return this.notify.testEmail(u.email);
  }

  @Get('stats')
  stats() {
    return this.svc.stats();
  }

  /** GET /admin/providers?status=PENDING */
  @Get('providers')
  list(@Query('status') status: ProfileStatus = 'PENDING') {
    if (!Object.values(ProfileStatus).includes(status)) throw new BadRequestException('Statut invalide');
    return this.svc.list(status);
  }

  @Post('providers/:id/approve')
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.decide(u.sub, id, 'APPROVED');
  }

  @Post('providers/:id/reject')
  reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: RejectDto) {
    return this.svc.decide(u.sub, id, 'REJECTED', dto.reason);
  }
}

@Module({ controllers: [AdminController], providers: [AdminService, AdminToolsService] })
export class AdminModule {}
