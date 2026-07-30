import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Client Prisma PRIVILEGIE (role owner) reserve aux taches systeme/background.
 * Surface restreinte : notification, video, conversation, SQL brut controle.
 */
@Injectable()
export class SystemPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemPrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient({
      datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    });
  }

  get notification(): PrismaClient['notification'] {
    return this.client.notification;
  }

  get video(): PrismaClient['video'] {
    return this.client.video;
  }

  get conversation(): PrismaClient['conversation'] {
    return this.client.conversation;
  }

  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number> {
    return this.client.$executeRawUnsafe(query, ...values);
  }

  $executeRaw(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<number> {
    return this.client.$executeRaw(query as TemplateStringsArray, ...values);
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('Connexion systeme (owner) etablie — surface restreinte');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
