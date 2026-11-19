import {
  BadRequestException,
  Body,
  Controller,
  Injectable,
  Module,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/auth.decorators';
import { refreshRating } from '../auth/auth.service';
import { assertEmailVerified } from '../common/verified';
import { PrismaService } from '../prisma/prisma.service';

class CreateReviewDto {
  @IsString() profileId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

/**
 * Reviews. Rule for V1: a customer can review a provider only after the
 * provider ACCEPTED one of their appointment requests — this keeps fake
 * reviews out without building a full payment/booking history.
 */
@Injectable()
class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async upsert(authorId: string, dto: CreateReviewDto) {
    await assertEmailVerified(this.prisma, authorId);
    const profile = await this.prisma.providerProfile.findUnique({ where: { id: dto.profileId } });
    if (!profile || profile.status !== 'APPROVED') throw new NotFoundException();
    const hadAppointment = await this.prisma.appointmentRequest.count({
      where: { profileId: profile.id, customerId: authorId, status: 'ACCEPTED' },
    });
    if (!hadAppointment) {
      throw new BadRequestException('Vous pourrez laisser un avis après un rendez-vous accepté');
    }

    const review = await this.prisma.review.upsert({
      where: { profileId_authorId: { profileId: profile.id, authorId } },
      create: { ...dto, authorId },
      update: { rating: dto.rating, comment: dto.comment },
    });

    // Refresh the denormalised rating on the profile (used for sorting in search).
    await refreshRating(this.prisma, profile.id);
    return review;
  }
}

@Controller('reviews')
class ReviewsController {
  constructor(private svc: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateReviewDto) {
    return this.svc.upsert(u.sub, dto);
  }
}

@Module({ controllers: [ReviewsController], providers: [ReviewsService] })
export class ReviewsModule {}
