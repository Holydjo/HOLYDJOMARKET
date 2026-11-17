import { Controller, Get, Module, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PLACES } from '../common/places';
import { GeocodingService } from '../geo/geocoding.service';
import { PrismaService } from '../prisma/prisma.service';

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
export class CategoriesModule {}
