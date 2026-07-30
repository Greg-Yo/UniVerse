import { Injectable, NotFoundException } from '@nestjs/common';
import { TypeNotification } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { assertCleAppartientA } from '../common/storage/storage-key';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateRessourceDto, ReplyRessourceDto } from './dto/resource.dto';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private ctx(user: AuthUser) {
    return { userId: user.id, rang: user.rang };
  }

  /**
   * Publie une ressource (MOD-1). La RLS exige que l'auteur soit moderateur
   * assigne au canal (ou Admin de l'universite). Notifie les etudiants du
   * niveau associe (NOTIF-1, best-effort).
   */
  async publier(user: AuthUser, dto: CreateRessourceDto) {
    const fichierCle = dto.fichierCle
      ? assertCleAppartientA(dto.fichierCle, user.id)
      : undefined;

    const ressource = await this.prisma.withRlsContext(this.ctx(user), async (tx) => {
      const creee = await tx.ressource.create({
        data: {
          canalId: dto.canalId,
          auteurId: user.id,
          type: dto.type,
          titre: dto.titre,
          contenu: dto.contenu,
          fichierCle,
        },
      });

      const canal = await tx.canal.findUnique({
        where: { id: dto.canalId },
        include: { matiere: { select: { niveauId: true } } },
      });
      if (canal) {
        const etudiants = await tx.utilisateur.findMany({
          where: { niveauId: canal.matiere.niveauId, rang: 'etudiant' },
          select: { id: true },
          take: 2000,
        });
        for (const e of etudiants) {
          await this.notifications.creer(tx, e.id, TypeNotification.nouvelle_ressource, {
            ressourceId: creee.id,
            canalId: dto.canalId,
          });
        }
      }
      return creee;
    });

    return ressource;
  }

  listerParCanal(user: AuthUser, canalId: string, avant?: string, limite = 30) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.ressource.findMany({
        where: { canalId, estSupprime: false, ...(avant ? { createdAt: { lt: new Date(avant) } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limite, 100),
      }),
    );
  }

  /** Repond dans le fil d'une ressource (ET-3, imbrication via repondAId). */
  async repondre(user: AuthUser, ressourceId: string, dto: ReplyRessourceDto) {
    const resultat = await this.prisma.withRlsContext(this.ctx(user), async (tx) => {
      const ressource = await tx.ressource.findUnique({ where: { id: ressourceId } });
      if (!ressource || ressource.estSupprime) {
        throw new NotFoundException('Ressource introuvable');
      }
      const message = await tx.message.create({
        data: {
          ressourceId,
          auteurId: user.id,
          contenu: dto.contenu,
          repondAId: dto.repondAId,
        },
      });
      if (ressource.auteurId !== user.id) {
        await this.notifications.creer(tx, ressource.auteurId, TypeNotification.reponse_recue, {
          ressourceId,
          messageId: message.id,
        });
      }
      return { message, auteurRessource: ressource.auteurId };
    });

    this.realtime.emettreMessageRessource(ressourceId, resultat.message);
    if (resultat.auteurRessource !== user.id) {
      this.realtime.emettreNotification(resultat.auteurRessource, {
        type: TypeNotification.reponse_recue,
        ressourceId,
      });
    }
    return resultat.message;
  }

  messagesRessource(user: AuthUser, ressourceId: string, avant?: string, limite = 50) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.message.findMany({
        where: {
          ressourceId,
          estSupprime: false,
          ...(avant ? { createdAt: { lt: new Date(avant) } } : {}),
        },
        orderBy: { createdAt: 'asc' },
        take: Math.min(limite, 100),
      }),
    );
  }

  /** Soft-delete (MOD-4). La RLS restreint a l'auteur ou l'Admin de l'univ. */
  archiver(user: AuthUser, ressourceId: string) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.ressource.update({ where: { id: ressourceId }, data: { estSupprime: true } }),
    );
  }
}
