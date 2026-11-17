import { Controller, Get, Module } from '@nestjs/common';
import { PLACES } from '../common/places';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read-only reference data used by the search UI:
 *   GET /categories  → service categories (hair, braids, …)
 *   GET /places      → neighbourhoods/cities customers can pick instead of GPS
 */
@Controller()
class CatalogController {
  constructor(private prisma: PrismaService) {}

  @Get('categories')
  categories() {
    return this.prisma.category.findMany({ orderBy: { order: 'asc' } });
  }

  @Get('places')
  places() {
    return PLACES;
  }
}

@Module({ controllers: [CatalogController] })
export class CategoriesModule {}
