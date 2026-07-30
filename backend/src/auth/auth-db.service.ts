import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Client Prisma PRIVILEGIE (role owner via DIRECT_URL) reserve a l'authentification.
 *
 * Surface volontairement etroite : uniquement `utilisateur` et `sessionDevice`.
 * Ne pas etendre cette facade pour le metier (utiliser PrismaService + RLS).
 */
@Injectable()
export class AuthDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthDbService.name);
  private readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient({
      datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    });
  }

  get utilisateur(): PrismaClient['utilisateur'] {
    return this.client.utilisateur;
  }

  get sessionDevice(): PrismaClient['sessionDevice'] {
    return this.client.sessionDevice;
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('Connexion auth (owner) etablie — surface: utilisateur, sessionDevice');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
