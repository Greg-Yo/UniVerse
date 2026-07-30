import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

function resolveCorsOrigins(logger: Logger): string[] | boolean {
  const raw = process.env.CORS_ORIGINS ?? '';
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isProd = process.env.NODE_ENV === 'production';

  if (origins.length === 0) {
    if (isProd) {
      throw new Error(
        'CORS_ORIGINS est obligatoire en production (liste d\'origines separees par des virgules).',
      );
    }
    logger.warn('CORS_ORIGINS vide — reflexion des origines activee (dev uniquement)');
    return true;
  }
  return origins;
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    });
    logger.log('Sentry initialise');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });

  app.set('trust proxy', 1);
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  app.use(helmet());
  app.use(cookieParser());
  const corsOrigins = resolveCorsOrigins(logger);
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('UniVerse API')
      .setDescription('Backend maison UniVerse (remplacement de Supabase)')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    logger.log('Swagger disponible sur /docs');
  } else {
    logger.log('Swagger desactive (NODE_ENV=production)');
  }

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`UniVerse API demarree sur le port ${port}`);
}

bootstrap();
