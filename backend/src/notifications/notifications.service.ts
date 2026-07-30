import { Injectable } from '@nestjs/common';
import { Prisma, TypeNotification } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SystemPrismaService } from '../common/prisma/system-prisma.service';
import { AuthUser } from '../common/types/auth-user';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemDb: SystemPrismaService,
  ) {}

  /**
   * Cree une notification via le role owner (hors RLS INSERT).
   * Empêche tout utilisateur universe_app d'insérer des notifs arbitraires
   * (policy INSERT retiree, cf. migration sprint2).
   */
  async creer(
    _tx: Prisma.TransactionClient,
    destinataireId: string,
    type: TypeNotification,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.systemDb.notification.create({
      data: { destinataireId, type, payload: payload as Prisma.InputJsonValue },
    });
  }

  async lister(user: AuthUser, seulementNonLues = false) {
    return this.prisma.withRlsContext({ userId: user.id, rang: user.rang }, (tx) =>
      tx.notification.findMany({
        where: { destinataireId: user.id, ...(seulementNonLues ? { lu: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  async marquerLu(user: AuthUser, id: string) {
    return this.prisma.withRlsContext({ userId: user.id, rang: user.rang }, (tx) =>
      tx.notification.updateMany({
        where: { id, destinataireId: user.id },
        data: { lu: true },
      }),
    );
  }
}
