import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { redisConnectionFromEnv } from '../common/redis/redis-connection';

/**
 * Compteur d'echecs de login par email (anti stuffing distribue).
 * Utilise Redis si disponible, sinon memoire process (dev / tests).
 */
@Injectable()
export class LoginThrottleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoginThrottleService.name);
  private redis?: Redis;
  private readonly memoire = new Map<string, { n: number; until: number }>();

  private readonly maxEchecs: number;
  private readonly fenetreSec: number;

  constructor(private readonly config: ConfigService) {
    this.maxEchecs = Number(config.get('LOGIN_MAX_FAILURES') ?? 8);
    this.fenetreSec = Number(config.get('LOGIN_LOCKOUT_SEC') ?? 900);
  }

  async onModuleInit(): Promise<void> {
    const host = this.config.get<string>('REDIS_HOST');
    if (!host) {
      this.logger.warn('REDIS_HOST absent — lockout login en memoire process uniquement');
      return;
    }
    const conn = redisConnectionFromEnv({
      REDIS_HOST: host,
      REDIS_PORT: this.config.get<string>('REDIS_PORT') ?? undefined,
      REDIS_PASSWORD: this.config.get<string>('REDIS_PASSWORD') || undefined,
      REDIS_TLS: this.config.get<string>('REDIS_TLS') ?? process.env.REDIS_TLS,
    } as NodeJS.ProcessEnv);
    this.redis = new Redis({
      host: conn.host,
      port: conn.port,
      password: conn.password,
      ...(conn.tls ? { tls: conn.tls } : {}),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    try {
      await this.redis.connect();
      this.logger.log('Lockout login branche sur Redis');
    } catch (e) {
      this.logger.warn(`Redis lockout indisponible, fallback memoire : ${(e as Error).message}`);
      await this.redis.quit().catch(() => undefined);
      this.redis = undefined;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  private cle(email: string): string {
    return `login:fail:${email.trim().toLowerCase()}`;
  }

  async assertNonVerrouille(email: string): Promise<void> {
    const cle = this.cle(email);
    if (this.redis) {
      const n = Number((await this.redis.get(cle)) ?? 0);
      if (n >= this.maxEchecs) {
        throw new UnauthorizedException('Identifiants invalides');
      }
      return;
    }
    const entree = this.memoire.get(cle);
    if (entree && entree.until > Date.now() && entree.n >= this.maxEchecs) {
      throw new UnauthorizedException('Identifiants invalides');
    }
  }

  async enregistrerEchec(email: string): Promise<void> {
    const cle = this.cle(email);
    if (this.redis) {
      const n = await this.redis.incr(cle);
      if (n === 1) {
        await this.redis.expire(cle, this.fenetreSec);
      }
      return;
    }
    const maintenant = Date.now();
    const entree = this.memoire.get(cle);
    if (!entree || entree.until <= maintenant) {
      this.memoire.set(cle, { n: 1, until: maintenant + this.fenetreSec * 1000 });
      return;
    }
    entree.n += 1;
  }

  async reinitialiser(email: string): Promise<void> {
    const cle = this.cle(email);
    if (this.redis) {
      await this.redis.del(cle);
      return;
    }
    this.memoire.delete(cle);
  }
}
