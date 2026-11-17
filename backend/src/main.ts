import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validate every request body / query against its DTO; strip unknown fields.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:4000' });

  const port = Number(process.env.PORT ?? 4001);
  await app.listen(port);
  console.log(`HOLYDO MARKET API → http://localhost:${port}`);
}
void bootstrap();
