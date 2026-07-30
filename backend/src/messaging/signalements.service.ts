import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CibleContenu, StatutSignalement, TypeSignalement } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { Rang } from '../common/enums/rang.enum';
import { AuthUser } from '../common/types/auth-user';
import {
  CreateSignalementContenuDto,
  CreateSignalementPersonneDto,
} from './dto/signalement.dto';

/**
 * Signalement = flux asynchrone simple (cf. 3.8, 4.2 #20). Deux variantes :
 *  - personne : Etudiant -> Moderateur/Admin Universite (exception a la
 *    messagerie classique, cf. matrice 3.8) ;
 *  - contenu : n'importe quel role signale une Video ou un Livre.
 */
@Injectable()
export class SignalementsService {
  constructor(private readonly prisma: PrismaService) {}

  async signalerPersonne(user: AuthUser, dto: CreateSignalementPersonneDto) {
    if (user.rang !== Rang.etudiant) {
      throw new ForbiddenException(
        'Seuls les etudiants peuvent emettre un signalement personne (cf. 3.8).',
      );
    }
    return this.prisma.withRlsContext({ userId: user.id, rang: user.rang }, async (tx) => {
      const destinataire = await tx.utilisateur.findUnique({
        where: { id: dto.destinataireId },
        select: { id: true, rang: true },
      });
      if (!destinataire) {
        throw new NotFoundException('Destinataire introuvable');
      }
      const rangDest = destinataire.rang as unknown as Rang;
      if (rangDest !== Rang.moderateur && rangDest !== Rang.admin_universite) {
        throw new BadRequestException(
          'Un signalement personne ne peut viser qu\'un Moderateur ou un Admin Universite (cf. 3.8).',
        );
      }
      return tx.signalement.create({
        data: {
          type: TypeSignalement.personne,
          emetteurId: user.id,
          destinataireId: dto.destinataireId,
          canalId: dto.canalId,
          sujet: dto.sujet,
          description: dto.description,
        },
      });
    });
  }

  async signalerContenu(user: AuthUser, dto: CreateSignalementContenuDto) {
    if (dto.cible === CibleContenu.video && !dto.videoId) {
      throw new BadRequestException('videoId requis pour un signalement de video');
    }
    if (dto.cible === CibleContenu.livre && !dto.livreId) {
      throw new BadRequestException('livreId requis pour un signalement de livre');
    }
    return this.prisma.withRlsContext({ userId: user.id, rang: user.rang }, async (tx) => {
      // L8 : destinataire obligatoire — sinon le signalement est invisible hors emetteur/superadmin (RLS).
      const destinataire = await tx.utilisateur.findUnique({
        where: { id: dto.destinataireId },
        select: { id: true, rang: true },
      });
      if (!destinataire) {
        throw new NotFoundException('Destinataire introuvable');
      }
      const rangDest = destinataire.rang as unknown as Rang;
      if (
        rangDest !== Rang.moderateur &&
        rangDest !== Rang.admin_universite &&
        rangDest !== Rang.superadmin
      ) {
        throw new BadRequestException(
          'Un signalement contenu doit viser un Moderateur, Admin Universite ou Superadmin.',
        );
      }
      return tx.signalement.create({
        data: {
          type: TypeSignalement.contenu,
          emetteurId: user.id,
          destinataireId: dto.destinataireId,
          cible: dto.cible,
          videoId: dto.cible === CibleContenu.video ? dto.videoId : null,
          livreId: dto.cible === CibleContenu.livre ? dto.livreId : null,
          sujet: dto.sujet,
          description: dto.description,
        },
      });
    });
  }

  async listerRecus(user: AuthUser) {
    return this.prisma.withRlsContext({ userId: user.id, rang: user.rang }, (tx) =>
      tx.signalement.findMany({
        where: { OR: [{ destinataireId: user.id }, { traiteParId: user.id }] },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async changerStatut(user: AuthUser, id: string, statut: StatutSignalement) {
    return this.prisma.withRlsContext({ userId: user.id, rang: user.rang }, async (tx) => {
      const maj = await tx.signalement.updateMany({
        where: {
          id,
          OR: [{ destinataireId: user.id }, { traiteParId: user.id }],
        },
        data: { statut, traiteParId: user.id },
      });
      if (maj.count === 0) {
        throw new ForbiddenException('Signalement introuvable ou non assigne');
      }
      return tx.signalement.findUnique({ where: { id } });
    });
  }
}
