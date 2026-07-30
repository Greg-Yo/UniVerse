import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthDbService } from '../auth/auth-db.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtAccessPayload } from '../common/types/auth-user';

/**
 * Gateway Socket.io (remplace Supabase Realtime).
 *
 * Auth : uniquement `handshake.auth.token` (JWT d'acces). Pas de query string.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authDb: AuthDbService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        throw new Error('token manquant (handshake.auth.token requis)');
      }
      const payload = await this.jwt.verifyAsync<JwtAccessPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (!payload.sid) {
        throw new Error('access token sans session');
      }
      // Lookup hors RLS (meme source de confiance que JwtStrategy).
      const [utilisateur, session] = await Promise.all([
        this.authDb.utilisateur.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            rang: true,
            niveauId: true,
            universiteAdministreeId: true,
            emailVerifie: true,
            groupeTds: { select: { id: true } },
          },
        }),
        this.authDb.sessionDevice.findUnique({ where: { id: payload.sid } }),
      ]);
      if (!utilisateur || !utilisateur.emailVerifie) {
        throw new Error('utilisateur invalide ou email non verifie');
      }
      if (
        !session ||
        session.utilisateurId !== utilisateur.id ||
        session.revokedAt !== null ||
        session.expiresAt < new Date()
      ) {
        throw new Error('session expiree ou revoquee');
      }
      const user: JwtAccessPayload = {
        sub: utilisateur.id,
        sid: session.id,
        email: utilisateur.email,
        rang: utilisateur.rang as JwtAccessPayload['rang'],
        niveauId: utilisateur.niveauId,
        universiteAdministreeId: utilisateur.universiteAdministreeId,
        estTuteurTds: Boolean(utilisateur.groupeTds),
      };
      client.data.user = user;
      client.join(`user:${utilisateur.id}`);
      this.logger.debug(`Socket connecte : ${utilisateur.id}`);
    } catch (e) {
      this.logger.warn(`Connexion socket refusee : ${(e as Error).message}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('rejoindre_ressource')
  rejoindreRessource(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ressourceId: string },
  ): { ok: boolean } {
    client.join(`ressource:${data.ressourceId}`);
    return { ok: true };
  }

  @SubscribeMessage('rejoindre_conversation')
  async rejoindreConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): Promise<{ ok: boolean }> {
    const user = client.data.user as JwtAccessPayload | undefined;
    if (!user) {
      return { ok: false };
    }
    const conversation = await this.prisma.withRlsContext(
      { userId: user.sub, rang: user.rang },
      (tx) => tx.conversation.findUnique({ where: { id: data.conversationId } }),
    );
    if (!conversation) {
      return { ok: false };
    }
    client.join(`conversation:${data.conversationId}`);
    return { ok: true };
  }

  emettreMessageRessource(ressourceId: string, message: unknown): void {
    this.server.to(`ressource:${ressourceId}`).emit('message_ressource', message);
  }

  emettreMessageConversation(conversationId: string, message: unknown): void {
    this.server.to(`conversation:${conversationId}`).emit('message_conversation', message);
  }

  emettreNotification(utilisateurId: string, notification: unknown): void {
    this.server.to(`user:${utilisateurId}`).emit('notification', notification);
  }
}
