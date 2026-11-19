import { Body, Controller, Get, Logger, Module, OnModuleInit, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth.decorators';
import { Throttle } from '@nestjs/throttler';
import { PLACES } from '../common/places';
import { GeocodingService } from '../geo/geocoding.service';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';
import { DEFAULT_CATEGORIES } from './default-categories';

/**
 * Reference data used by the search UI:
 *   GET /categories           public service categories (approved only)
 *   GET /places               built-in list of neighbourhoods (quick picks)
 *   GET /places/search?q=…    address / neighbourhood autocomplete (OpenStreetMap)
 */
@Controller()
class CatalogController {
  constructor(
    private categories: CategoriesService,
    private geo: GeocodingService,
  ) {}

  @Get('categories')
  list() {
    return this.categories.publicList();
  }

  @Get('places')
  places() {
    return PLACES;
  }

  @Get('places/search')
  @Throttle({ default: { ttl: 60_000, limit: 40 } }) // protects the free geocoder
  search(@Query('q') q = '', @Query('lat') lat?: string, @Query('lng') lng?: string) {
    return this.geo.search(String(q).slice(0, 120), 6, near(lat, lng));
  }
}

/** Optional "near" point for address suggestions; ignored unless it's a valid position. */
function near(lat?: string, lng?: string) {
  const la = Number(lat), lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180 && lat && lng
    ? { lat: la, lng: lo }
    : undefined;
}

class ProposeCategoryDto {
  @IsString() @MinLength(2) @MaxLength(40) name: string;
}

class ApproveCategoryDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) name?: string;
  @IsOptional() @IsString() @MaxLength(16) icon?: string; // an emoji
}

class RejectCategoryDto {
  @IsString() replaceWithId: string;
}

/** Providers: list everything they can use, and propose a missing category. */
@Controller('me/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PROVIDER')
class ProviderCategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.forProvider();
  }

  @Post()
  @Throttle({ default: { ttl: 24 * 3600_000, limit: 10 } }) // 10 proposals / day
  propose(@CurrentUser() u: AuthUser, @Body() dto: ProposeCategoryDto) {
    return this.categories.propose(u.sub, dto.name);
  }
}

/** Admins: review proposed categories. */
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
class AdminCategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get('pending')
  pending() {
    return this.categories.pending();
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveCategoryDto) {
    return this.categories.approve(id, dto);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectCategoryDto) {
    return this.categories.reject(id, dto.replaceWithId);
  }
}

@Module({
  controllers: [CatalogController, ProviderCategoriesController, AdminCategoriesController],
  providers: [GeocodingService, CategoriesService],
  exports: [GeocodingService],
})
export class CategoriesModule implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  /**
   * Makes sure every category exists on startup — so a brand-new database
   * (e.g. production) is usable without running the demo seed.
   * Idempotent: existing categories are updated in place, never duplicated.
   */
  async onModuleInit() {
    await this.prisma.$transaction(
      DEFAULT_CATEGORIES.map((c, order) =>
        this.prisma.category.upsert({
          where: { slug: c.slug },
          create: { ...c, order, status: 'APPROVED' },
          update: { name: c.name, icon: c.icon, order, status: 'APPROVED' },
        }),
      ),
    );
    new Logger('Categories').log(`${DEFAULT_CATEGORIES.length} categories ready`);
  }
}
