import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AdminModule } from './admin/admin.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { ReviewsModule } from './reviews/reviews.module';

/**
 * Root module. Each feature lives in its own folder under src/:
 *   auth          sign-up / login / JWT
 *   categories    reference data (categories + places)
 *   providers     public search + profile page, and the provider dashboard API
 *   appointments  booking requests between customers and providers
 *   reviews       customer ratings
 *   admin         moderation queue for new provider profiles
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Uploaded photos: ./uploads/<file> → http://api/uploads/<file>
    ServeStaticModule.forRoot({ rootPath: join(process.cwd(), 'uploads'), serveRoot: '/uploads' }),
    PrismaModule,
    AuthModule,
    CategoriesModule,
    ProvidersModule,
    AppointmentsModule,
    ReviewsModule,
    AdminModule,
  ],
})
export class AppModule {}
