import { Injectable } from '@nestjs/common';
import { Prisma, TypeNotification } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cree une notification via SECURITY DEFINER dans la transaction RLS courante.
   * Garantit atomicite avec le flux metier (pas d'orphelines si rollback).
   */
  async creer(
    tx: Prisma.TransactionClient,
    destinataireId: string,
    type: TypeNotification,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const json = payload === undefined ? null : JSON.stringify(payload);
    await tx.$executeRaw`
      SELECT app_creer_notification(
        ${destinataireId},
        ${type}::"TypeNotification",
        ${json}::jsonb
      )
    `;
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
