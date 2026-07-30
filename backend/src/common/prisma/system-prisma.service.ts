import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Client Prisma PRIVILEGIE (role owner) reserve aux taches systeme/background
 * qui n'ont pas d'utilisateur courant (jobs BullMQ : fermeture de fenetre 24h,
 * recalcul des compteurs). Ne pas utiliser dans le flux requete utilisateur.
 */
@Injectable()
export class SystemPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemPrismaService.name);

  constructor() {
    super({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connexion systeme (owner) etablie');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
