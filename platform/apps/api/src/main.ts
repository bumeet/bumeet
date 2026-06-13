import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

/** Fail fast on a missing/weak security-critical secret instead of booting insecurely. */
function requireEnv(name: string, minLength = 1): string {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(`Missing or too-short required env var ${name} (needs >= ${minLength} chars)`);
  }
  return value;
}

async function bootstrap() {
  // Refuse to start without a real JWT secret — no 'fallback-secret' default anywhere.
  requireEnv('JWT_SECRET', 32);

  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  // CORS: pin to an exact allowlist from config (comma-separated). No wildcard-suffix
  // regex on shared domains like *.azurestaticapps.net (any tenant would be allowed).
  const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on port ${port}`);
}

bootstrap();
