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
import { Throttle } from '@nestjs/throttler';
import { ReportStatus, ReportTarget } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth.decorators';
import { Notifier } from '../mail/notifier';
import { assertEmailVerified } from '../common/verified';
import { PrismaService } from '../prisma/prisma.service';

/** Why something is reported. Labels live in the frontend (lib/labels.ts). */
export const REPORT_REASONS = ['fake', 'offensive', 'scam', 'wrong_info', 'other'] as const;

class CreateReportDto {
  @IsIn(['PROFILE', 'REVIEW']) targetType: ReportTarget;
  @IsString() targetId: string;
  @IsIn(REPORT_REASONS as unknown as string[], { message: 'Choisissez une raison' }) reason: string;
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
}

class ResolveReportDto {
  @IsOptional() @IsString() @MaxLength(500) adminNote?: string;
}

/**
 * "Signaler": any logged-in user can report a provider profile or a review.
 * Admins are emailed and handle reports in Modération → Signalements, using
 * the existing tools (suspend a profile, delete a review), then mark them resolved.
 */
@Injectable()
class ReportsService {
  constructor(
    private prisma: PrismaService,
    private notify: Notifier,
  ) {}

  async create(reporterId: string, dto: CreateReportDto) {
    await assertEmailVerified(this.prisma, reporterId);
    const exists =
      dto.targetType === 'PROFILE'
        ? await this.prisma.providerProfile.findFirst({ where: { id: dto.targetId, status: 'APPROVED' }, select: { id: true } })
        : await this.prisma.review.findUnique({ where: { id: dto.targetId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Élément introuvable');

    // Per-account cap (audit H2: don't penalise people sharing a Wi-Fi).
    const today = await this.prisma.report.count({ where: { reporterId, createdAt: { gte: new Date(Date.now() - 86400_000) } } });
    if (today >= 10) throw new BadRequestException('Vous avez atteint la limite de 10 signalements par jour.');

    // Same person, same target, still open → don't create duplicates.
    const already = await this.prisma.report.findFirst({
      where: { reporterId, targetType: dto.targetType, targetId: dto.targetId, status: 'OPEN' },
    });
    if (already) return { ok: true, id: already.id, duplicate: true };

    const r = await this.prisma.report.create({ data: { ...dto, reporterId } });
    void this.notify.reportCreated(r.id).catch((e: Error) => console.error('[Mail]', e.message));
    return { ok: true, id: r.id };
  }

  /** Reports with what was reported (profile or review), oldest open first. */
  async list(status: ReportStatus) {
    const reports = await this.prisma.report.findMany({
      where: { status },
      orderBy: { createdAt: status === 'OPEN' ? 'asc' : 'desc' },
      take: 100,
      include: { reporter: { select: { firstName: true, lastName: true, email: true } } },
    });
    const profileIds = reports.filter((r) => r.targetType === 'PROFILE').map((r) => r.targetId);
    const reviewIds = reports.filter((r) => r.targetType === 'REVIEW').map((r) => r.targetId);
    const [profiles, reviews] = await Promise.all([
      this.prisma.providerProfile.findMany({
        where: { id: { in: profileIds } },
        select: { id: true, displayName: true, slug: true, status: true },
      }),
      this.prisma.review.findMany({
        where: { id: { in: reviewIds } },
        select: { id: true, rating: true, comment: true, author: { select: { firstName: true, lastName: true } }, profile: { select: { displayName: true, slug: true } } },
      }),
    ]);
    return reports.map((r) => ({
      ...r,
      // null = the target has been deleted since
      profile: r.targetType === 'PROFILE' ? profiles.find((p) => p.id === r.targetId) ?? null : null,
      review: r.targetType === 'REVIEW' ? reviews.find((v) => v.id === r.targetId) ?? null : null,
    }));
  }

  async resolve(id: string, adminNote?: string) {
    const r = await this.prisma.report.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    if (r.status === 'RESOLVED') throw new BadRequestException('Déjà traité');
    return this.prisma.report.update({ where: { id }, data: { status: 'RESOLVED', resolvedAt: new Date(), adminNote } });
  }
}

@Controller()
class ReportsController {
  constructor(private reports: ReportsService) {}

  @Post('reports')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 24 * 3600_000, limit: 50 } }) // generous per-IP ceiling; per-account cap in the service
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateReportDto) {
    return this.reports.create(u.sub, dto);
  }

  @Get('admin/reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  list(@Query('status') status: ReportStatus = 'OPEN') {
    if (!Object.values(ReportStatus).includes(status)) throw new BadRequestException('Statut invalide');
    return this.reports.list(status);
  }

  @Post('admin/reports/:id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  resolve(@Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.reports.resolve(id, dto.adminNote);
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
