import {
  BadRequestException,
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
import { ProfileStatus } from '@prisma/client';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth.decorators';
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
    const [customers, appointments, pendingCategories] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.appointmentRequest.count(),
      this.prisma.category.count({ where: { status: 'PENDING' } }),
    ]);
    return { byStatus, customers, appointments, pendingCategories };
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
    if (action === 'APPROVED' && p.status !== 'PENDING') {
      throw new BadRequestException('Seuls les profils en attente peuvent être approuvés');
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

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
class AdminController {
  constructor(private svc: AdminService) {}

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

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
