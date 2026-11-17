import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind a reverse proxy (Render), trust it so rate limiting sees the real client IP.
  // Only enable where a proxy really sits in front (TRUST_PROXY=1), otherwise clients
  // could fake their IP with an X-Forwarded-For header and dodge the limits.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  // Security headers. crossOriginResourcePolicy is relaxed so the website (another origin)
  // can display photos served from /uploads.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Validate every request body / query against its DTO; strip unknown fields.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Production: only the configured site(s), comma-separated in FRONTEND_URL.
  // Development: any origin, so phones on the local network can test the app.
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? (process.env.FRONTEND_URL ?? '').split(',').map((s) => s.trim())
        : true,
  });

  const port = Number(process.env.PORT ?? 4001);
  await app.listen(port);
  console.log(`HOLYDJO MARKET API → http://localhost:${port}`);
}
void bootstrap();
