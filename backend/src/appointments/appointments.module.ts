import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth.decorators';
import { Notifier } from '../mail/notifier';
import { PrismaService } from '../prisma/prisma.service';

// -----------------------------------------------------------------------------
// Appointment requests: a customer asks a provider for a slot; the provider
// accepts or declines from their dashboard. No payment in V1.
// -----------------------------------------------------------------------------

class CreateAppointmentDto {
  @IsString() profileId: string;
  @IsOptional() @IsString() serviceId?: string;
  @IsDateString() requestedAt: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
}

class UpdateAppointmentDto {
  @IsIn(['ACCEPTED', 'DECLINED', 'CANCELLED']) status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  @IsOptional() @IsString() @MaxLength(500) providerNote?: string;
}

const INCLUDE = {
  service: { select: { name: true, priceCents: true, durationMin: true } },
  profile: { select: { displayName: true, slug: true, phone: true, whatsapp: true, timeZone: true } },
  customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
};

const logError = (e: Error) => console.error('[Mail]', e.message);

@Injectable()
class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private notify: Notifier,
  ) {}

  async create(customerId: string, dto: CreateAppointmentDto) {
    const profile = await this.prisma.providerProfile.findUnique({ where: { id: dto.profileId } });
    if (!profile || profile.status !== 'APPROVED') throw new NotFoundException('Prestataire introuvable');
    if (profile.userId === customerId) throw new BadRequestException('Vous ne pouvez pas vous réserver vous-même');
    if (new Date(dto.requestedAt) < new Date()) throw new BadRequestException('Choisissez une date future');
    if (dto.serviceId) {
      const s = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
      if (!s || s.profileId !== profile.id) throw new BadRequestException('Service invalide');
    }
    const created = await this.prisma.appointmentRequest.create({
      data: { ...dto, requestedAt: new Date(dto.requestedAt), customerId },
      include: INCLUDE,
    });
    void this.notify.appointmentRequested(created.id).catch(logError);
    return created;
  }

  /** Requests the logged-in customer has sent. */
  mine(customerId: string) {
    return this.prisma.appointmentRequest.findMany({
      where: { customerId },
      include: INCLUDE,
      orderBy: { requestedAt: 'desc' },
    });
  }

  /** Requests received by the logged-in provider. */
  async received(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile) return [];
    const items = await this.prisma.appointmentRequest.findMany({
      where: { profileId: profile.id },
      include: INCLUDE,
      orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
    });
    // Privacy: the customer's email/phone are only shared once the provider accepts.
    return items.map((a) =>
      a.status === 'ACCEPTED' ? a : { ...a, customer: { ...a.customer, email: '', phone: null } },
    );
  }

  /** Provider accepts/declines; customer may only cancel their own request. */
  async update(user: AuthUser, id: string, dto: UpdateAppointmentDto) {
    const a = await this.prisma.appointmentRequest.findUnique({ where: { id }, include: { profile: true } });
    if (!a) throw new NotFoundException();
    const isProvider = a.profile.userId === user.sub;
    const isCustomer = a.customerId === user.sub;
    if (dto.status === 'CANCELLED' ? !isCustomer : !isProvider) throw new ForbiddenException();
    // Only pending requests can be answered or cancelled (avoids duplicate emails and flip-flopping).
    if (a.status !== 'PENDING') throw new BadRequestException('Cette demande a déjà été traitée');
    const updated = await this.prisma.appointmentRequest.update({ where: { id }, data: dto, include: INCLUDE });
    void (dto.status === 'CANCELLED' ? this.notify.appointmentCancelled(id) : this.notify.appointmentAnswered(id)).catch(logError);
    return updated;
  }
}

@Controller('appointments')
@UseGuards(JwtAuthGuard)
class AppointmentsController {
  constructor(private svc: AppointmentsService) {}

  @Post()
  @Throttle({ default: { ttl: 60 * 60_000, limit: 20 } }) // anti-spam: 20 requests / hour
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.svc.create(u.sub, dto);
  }

  @Get('mine')
  mine(@CurrentUser() u: AuthUser) {
    return this.svc.mine(u.sub);
  }

  @Get('received')
  @UseGuards(RolesGuard)
  @Roles('PROVIDER')
  received(@CurrentUser() u: AuthUser) {
    return this.svc.received(u.sub);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.svc.update(u, id, dto);
  }
}

@Module({ controllers: [AppointmentsController], providers: [AppointmentsService] })
export class AppointmentsModule {}
