import { Controller, Get, Logger, Module, OnModuleInit, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PLACES } from '../common/places';
import { GeocodingService } from '../geo/geocoding.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_CATEGORIES } from './default-categories';

/**
 * Reference data used by the search UI:
 *   GET /categories           service categories (hair, braids, …)
 *   GET /places               built-in list of neighbourhoods (quick picks)
 *   GET /places/search?q=…    address / neighbourhood autocomplete (OpenStreetMap)
 */
@Controller()
class CatalogController {
  constructor(
    private prisma: PrismaService,
    private geo: GeocodingService,
  ) {}

  @Get('categories')
  categories() {
    return this.prisma.category.findMany({ orderBy: { order: 'asc' } });
  }

  @Get('places')
  places() {
    return PLACES;
  }

  @Get('places/search')
  @Throttle({ default: { ttl: 60_000, limit: 40 } }) // protects the free geocoder
  search(@Query('q') q = '') {
    return this.geo.search(String(q).slice(0, 120));
  }
}

@Module({ controllers: [CatalogController], providers: [GeocodingService], exports: [GeocodingService] })
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
          create: { ...c, order },
          update: { name: c.name, icon: c.icon, order },
        }),
      ),
    );
    new Logger('Categories').log(`${DEFAULT_CATEGORIES.length} categories ready`);
  }
}
