import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { ServerOptions } from 'socket.io';

/**
 * Adaptateur Socket.io avec backend Redis (pub/sub), afin que les evenements
 * temps reel soient diffuses a tous les clients meme lorsque l'API tourne sur
 * plusieurs instances (montee en charge future, cf. plan).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const host = process.env.REDIS_HOST ?? 'localhost';
    const port = Number(process.env.REDIS_PORT ?? 6379);
    const password = process.env.REDIS_PASSWORD || undefined;

    if (process.env.NODE_ENV === 'production' && !password) {
      throw new Error('REDIS_PASSWORD est obligatoire en production');
    }

    const pubClient = new Redis({ host, port, password });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (e) => this.logger.error(`Redis pub: ${e.message}`));
    subClient.on('error', (e) => this.logger.error(`Redis sub: ${e.message}`));

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Adaptateur Socket.io/Redis pret');
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const corsOrigins = (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (process.env.NODE_ENV === 'production' && corsOrigins.length === 0) {
      throw new Error('CORS_ORIGINS est obligatoire en production (Socket.io)');
    }

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: corsOrigins.length ? corsOrigins : true,
        credentials: true,
      },
    });
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
