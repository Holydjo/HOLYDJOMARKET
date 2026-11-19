import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AdminModule } from './admin/admin.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { HealthController } from './health.controller';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { ReportsModule } from './reports/reports.module';
import { ReviewsModule } from './reviews/reviews.module';

/**
 * Root module. Each feature lives in its own folder under src/:
 *   auth          sign-up / login / JWT
 *   categories    reference data (categories + places)
 *   providers     public search + profile page, and the provider dashboard API
 *   appointments  booking requests between customers and providers
 *   reviews       customer ratings
 *   admin         moderation queue for new provider profiles
 *   mail          transactional emails (outbox + retries; console in dev)
 *   reports       "Signaler" a profile or a review
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting per IP address. Default: 120 requests/minute on every route;
    // sensitive routes override it with @Throttle (see auth, appointments, places).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      errorMessage: 'Trop de tentatives. Patientez quelques minutes puis réessayez.',
    }),
    // Uploaded photos: ./uploads/<file> → http://api/uploads/<file>
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
        dotfiles: 'deny',
        // Defence in depth (audit H1): a file served from /uploads can never run scripts or be framed.
        setHeaders: (res) => {
          res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'none'; sandbox");
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        },
      },
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    CategoriesModule,
    ProvidersModule,
    AppointmentsModule,
    ReviewsModule,
    ReportsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
