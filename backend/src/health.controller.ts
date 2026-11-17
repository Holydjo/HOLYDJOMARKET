import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/** GET /health — used by the host to know the API (and its database) is up. */
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}
