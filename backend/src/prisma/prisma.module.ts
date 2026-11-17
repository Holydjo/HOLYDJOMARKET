import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** @Global so feature modules don't need to import it each time. */
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
