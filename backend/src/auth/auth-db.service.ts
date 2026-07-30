import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Client Prisma PRIVILEGIE (role owner via DIRECT_URL) reserve a
 * l'authentification.
 *
 * Justification : les operations d'auth (recherche d'un compte par email avant
 * login, gestion des sessions/refresh tokens) ont lieu AVANT qu'une identite
 * RLS puisse etre positionnee. Elles constituent la racine de confiance et
 * s'executent donc hors RLS, sur une surface volontairement etroite (ce
 * service n'expose que les operations d'auth, jamais l'acces metier general).
 */
@Injectable()
export class AuthDbService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthDbService.name);

  constructor() {
    super({
      datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connexion auth (owner) etablie');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
