import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { assertCleAppartientA } from '../common/storage/storage-key';
import { JobsService } from '../jobs/jobs.service';
import { CreateVideoCreateurDto, CreateVideoTdsDto } from './dto/video.dto';

const YOUTUBE_ID_EN_ATTENTE = 'PENDING';

@Injectable()
export class VideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  private ctx(user: AuthUser) {
    return { userId: user.id, rang: user.rang };
  }

  private valider(
    user: AuthUser,
    dto: {
      youtubeId?: string;
      sourceObjectKey?: string;
      niveauCibleId?: string;
      matiereCibleeId?: string;
    },
  ): string | undefined {
    if (!dto.youtubeId && !dto.sourceObjectKey) {
      throw new BadRequestException('Fournir soit youtubeId, soit sourceObjectKey');
    }
    if (dto.niveauCibleId && dto.matiereCibleeId) {
      throw new BadRequestException('Ciblage niveau et matiere mutuellement exclusifs (cf. 4.4)');
    }
    if (!dto.sourceObjectKey) {
      return undefined;
    }
    // La cle source doit appartenir a l'uploader (evite exfiltration / suppression).
    return assertCleAppartientA(dto.sourceObjectKey, user.id);
  }

  /** Publication par un Compte_Createur (FO-1 / EN-1, rang >= formateur). */
  async publierCreateur(user: AuthUser, dto: CreateVideoCreateurDto) {
    const sourceObjectKey = this.valider(user, dto);
    const { video, uploadNecessaire } = await this.prisma.withRlsContext(this.ctx(user), async (tx) => {
      const compte = await tx.compteCreateur.findUnique({ where: { utilisateurId: user.id } });
      if (!compte) {
        throw new ForbiddenException('Aucun Compte_Createur (demande de statut requise, cf. SA-3/SA-4)');
      }
      const creee = await tx.video.create({
        data: {
          titre: dto.titre,
          description: dto.description,
          youtubeId: dto.youtubeId ?? YOUTUBE_ID_EN_ATTENTE,
          compteCreateurId: compte.id,
          niveauCibleId: dto.niveauCibleId,
          matiereCibleeId: dto.matiereCibleeId,
        },
      });
      return { video: creee, uploadNecessaire: !dto.youtubeId && Boolean(sourceObjectKey) };
    });

    if (uploadNecessaire && sourceObjectKey) {
      await this.jobs.enfilerUploadYoutube({
        videoId: video.id,
        sourceObjectKey,
        ownerUserId: user.id,
        titre: dto.titre,
        description: dto.description,
      });
    }
    return video;
  }

  /** Publication dans un Groupe TDS (TDS-2). */
  async publierTds(user: AuthUser, dto: CreateVideoTdsDto) {
    const sourceObjectKey = this.valider(user, dto);
    const { video, uploadNecessaire } = await this.prisma.withRlsContext(this.ctx(user), async (tx) => {
      const groupe = await tx.groupeTds.findUnique({ where: { id: dto.groupeTdsId } });
      if (!groupe || groupe.tuteurId !== user.id) {
        throw new ForbiddenException('Seul le tuteur du Groupe TDS peut y publier');
      }
      const creee = await tx.video.create({
        data: {
          titre: dto.titre,
          description: dto.description,
          youtubeId: dto.youtubeId ?? YOUTUBE_ID_EN_ATTENTE,
          groupeTdsId: dto.groupeTdsId,
          niveauCibleId: dto.niveauCibleId,
          matiereCibleeId: dto.matiereCibleeId,
        },
      });
      return { video: creee, uploadNecessaire: !dto.youtubeId && Boolean(sourceObjectKey) };
    });

    if (uploadNecessaire && sourceObjectKey) {
      await this.jobs.enfilerUploadYoutube({
        videoId: video.id,
        sourceObjectKey,
        ownerUserId: user.id,
        titre: dto.titre,
        description: dto.description,
      });
    }
    return video;
  }

  /**
   * Fil video oriente (ET-4) : par niveau de rattachement puis par abonnements.
   * La RLS filtre automatiquement le masquage et la visibilite TDS.
   */
  feed(user: AuthUser, avant?: string, limite = 20) {
    return this.prisma.withRlsContext(this.ctx(user), async (tx) => {
      const abonnements = await tx.abonnement.findMany({
        where: { utilisateurId: user.id },
        select: { compteCreateurId: true },
      });
      const compteIds = abonnements.map((a) => a.compteCreateurId);
      return tx.video.findMany({
        where: {
          estMasquee: false,
          ...(avant ? { createdAt: { lt: new Date(avant) } } : {}),
          OR: [
            ...(user.niveauId ? [{ niveauCibleId: user.niveauId }] : []),
            ...(compteIds.length ? [{ compteCreateurId: { in: compteIds } }] : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limite, 50),
      });
    });
  }

  /** Recherche par filtres (ET-15) - s'appuie sur les metadonnees en base (cf. 7.3). */
  rechercher(
    user: AuthUser,
    filtres: { niveauCibleId?: string; matiereCibleeId?: string; motCle?: string },
    limite = 20,
  ) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.video.findMany({
        where: {
          estMasquee: false,
          niveauCibleId: filtres.niveauCibleId,
          matiereCibleeId: filtres.matiereCibleeId,
          ...(filtres.motCle
            ? { titre: { contains: filtres.motCle, mode: 'insensitive' } }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limite, 50),
      }),
    );
  }

  /** Like (ET-17). Le trigger SQL met a jour Video.nombreLikes. */
  async liker(user: AuthUser, videoId: string) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.likeVideo.upsert({
        where: { utilisateurId_videoId: { utilisateurId: user.id, videoId } },
        update: {},
        create: { utilisateurId: user.id, videoId },
      }),
    );
  }

  async retirerLike(user: AuthUser, videoId: string) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.likeVideo.deleteMany({ where: { utilisateurId: user.id, videoId } }),
    );
  }

  /** Masquage d'urgence (AU-9 / Superadmin). La RLS verifie le perimetre. */
  async masquer(user: AuthUser, videoId: string, masquee: boolean) {
    return this.prisma.withRlsContext(this.ctx(user), async (tx) => {
      const maj = await tx.video.updateMany({
        where: { id: videoId },
        data: { estMasquee: masquee, masqueParId: masquee ? user.id : null },
      });
      if (maj.count === 0) {
        throw new NotFoundException('Video introuvable ou hors perimetre');
      }
      return tx.video.findUnique({ where: { id: videoId } });
    });
  }
}
