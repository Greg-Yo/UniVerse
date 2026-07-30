import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export interface RlsContext {
  userId?: string | null;
  rang?: string | null;
}

/**
 * Client Prisma partage.
 *
 * L'API se connecte via DATABASE_URL avec le role NON superuser `universe_app`,
 * ce qui active la RLS PostgreSQL (cf. RUNBOOK / migration RLS). Pour que les
 * policies aient acces a l'identite courante, chaque acces "protege" doit passer
 * par `withRlsContext`, qui ouvre une transaction et positionne les GUC
 * `app.current_user_id` / `app.current_rang` via SET LOCAL.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connexion PostgreSQL etablie');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Execute `fn` dans une transaction ou l'identite RLS est positionnee.
   * `set_config(..., true)` limite la portee a la transaction courante.
   */
  async withRlsContext<T>(
    ctx: RlsContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${ctx.userId ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_rang', ${ctx.rang ?? ''}, true)`;
      return fn(tx);
    });
  }
}
