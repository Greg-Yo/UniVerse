import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TypeNotification } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { Rang } from '../common/enums/rang.enum';
import { MessagingPolicy } from '../common/messaging/messaging-policy';
import { AuthUser } from '../common/types/auth-user';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ConversationsService {
  private readonly fenetreHeures: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {
    this.fenetreHeures = Number(config.get('CONVERSATION_TEACHER_WINDOW_HOURS') ?? 24);
  }

  /**
   * Cree (ou recupere) une conversation directe, en appliquant strictement la
   * matrice de messagerie 3.8 via MessagingPolicy (rang exact, pas d'heritage).
   */
  async creerOuRecuperer(user: AuthUser, destinataireId: string) {
    if (destinataireId === user.id) {
      throw new BadRequestException('Impossible de converser avec soi-meme');
    }

    return this.prisma.withRlsContext({ userId: user.id, rang: user.rang }, async (tx) => {
      const destinataire = await tx.utilisateur.findUnique({
        where: { id: destinataireId },
        select: {
          id: true,
          rang: true,
          groupeTds: { select: { id: true } },
        },
      });
      if (!destinataire) {
        throw new NotFoundException('Destinataire introuvable');
      }

      const decision = MessagingPolicy.resoudreCreation(
        { rang: user.rang, estTuteurTds: user.estTuteurTds },
        {
          rang: destinataire.rang as unknown as Rang,
          estTuteurTds: Boolean(destinataire.groupeTds),
        },
      );

      if (!decision.autorise) {
        if (decision.canal === 'signalement') {
          throw new BadRequestException(
            `${decision.raison} Utilisez l'endpoint POST /signalements.`,
          );
        }
        throw new ForbiddenException(decision.raison);
      }

      const existante = await tx.conversation.findFirst({
        where: {
          OR: [
            { utilisateurUnId: user.id, utilisateurDeuxId: destinataireId },
            { utilisateurUnId: destinataireId, utilisateurDeuxId: user.id },
          ],
        },
      });
      if (existante) {
        return existante;
      }

      const estFenetre = decision.type === 'fenetre_reponse';
      const dateExpirationFenetre = estFenetre
        ? new Date(Date.now() + this.fenetreHeures * 3600_000)
        : null;

      const conversation = await tx.conversation.create({
        data: {
          utilisateurUnId: user.id,
          utilisateurDeuxId: destinataireId,
          type: estFenetre ? 'fenetre_reponse' : 'libre',
          dateExpirationFenetre,
        },
      });

      if (estFenetre) {
        await this.jobs.planifierFermetureFenetre(
          conversation.id,
          this.fenetreHeures * 3600_000,
        );
      }
      return conversation;
    });
  }

  async posterMessage(user: AuthUser, conversationId: string, contenu: string) {
    const resultat = await this.prisma.withRlsContext(
      { userId: user.id, rang: user.rang },
      async (tx) => {
        const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation) {
          throw new NotFoundException('Conversation introuvable');
        }
        if (!MessagingPolicy.peutPosterDansConversation(conversation.statut)) {
          throw new ForbiddenException(
            'Le fil est ferme (fenetre de reponse expiree). En attente d\'une reponse de l\'enseignant.',
          );
        }

        const message = await tx.message.create({
          data: { conversationId, auteurId: user.id, contenu },
        });

        // Gestion de la fenetre 24h (EN-3) - cf. 4.4.
        await this.majFenetre(tx, conversation, user);

        const destinataireId =
          conversation.utilisateurUnId === user.id
            ? conversation.utilisateurDeuxId
            : conversation.utilisateurUnId;

        await this.notifications.creer(tx, destinataireId, TypeNotification.nouveau_message_direct, {
          conversationId,
          messageId: message.id,
        });

        return { message, destinataireId };
      },
    );

    // Effets temps reel hors transaction.
    this.realtime.emettreMessageConversation(conversationId, resultat.message);
    this.realtime.emettreNotification(resultat.destinataireId, {
      type: TypeNotification.nouveau_message_direct,
      conversationId,
    });
    return resultat.message;
  }

  private async majFenetre(
    tx: Prisma.TransactionClient,
    conversation: { id: string; type: string; aDejaRepondu: boolean },
    auteur: AuthUser,
  ): Promise<void> {
    if (conversation.type !== 'fenetre_reponse') {
      return;
    }
    if (auteur.rang === Rang.enseignant) {
      // Reponse de l'Enseignant : rouvre et neutralise la fenetre (reversible).
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { statut: 'ouverte', aDejaRepondu: true, dateExpirationFenetre: null },
      });
    } else if (!conversation.aDejaRepondu) {
      // Nouveau message entrant vers l'Enseignant : (re)arme la fenetre.
      const echeance = new Date(Date.now() + this.fenetreHeures * 3600_000);
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { dateExpirationFenetre: echeance, statut: 'ouverte' },
      });
      await this.jobs.planifierFermetureFenetre(conversation.id, this.fenetreHeures * 3600_000);
    }
  }

  async lister(user: AuthUser) {
    return this.prisma.withRlsContext({ userId: user.id, rang: user.rang }, (tx) =>
      tx.conversation.findMany({
        where: { OR: [{ utilisateurUnId: user.id }, { utilisateurDeuxId: user.id }] },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  }

  async messages(user: AuthUser, conversationId: string, avant?: string, limite = 50) {
    return this.prisma.withRlsContext({ userId: user.id, rang: user.rang }, (tx) =>
      tx.message.findMany({
        where: { conversationId, estSupprime: false, ...(avant ? { createdAt: { lt: new Date(avant) } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limite, 100),
      }),
    );
  }
}
