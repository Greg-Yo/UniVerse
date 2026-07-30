import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SystemPrismaService } from '../common/prisma/system-prisma.service';
import { assertCleAppartientA } from '../common/storage/storage-key';
import { StorageService } from '../storage/storage.service';
import { YoutubeService } from '../video/youtube.service';
import { QUEUE_YOUTUBE_UPLOAD, YoutubeUploadJob } from './queues';

/**
 * Envoie un fichier video (depuis MinIO) vers YouTube en mode non repertorie,
 * puis met a jour Video.youtubeId. Retry gere par BullMQ (cf. risque quota 8.2).
 */
@Processor(QUEUE_YOUTUBE_UPLOAD)
export class YoutubeUploadProcessor extends WorkerHost {
  private readonly logger = new Logger(YoutubeUploadProcessor.name);

  constructor(
    private readonly db: SystemPrismaService,
    private readonly storage: StorageService,
    private readonly youtube: YoutubeService,
  ) {
    super();
  }

  async process(job: Job<YoutubeUploadJob>): Promise<void> {
    const { videoId, sourceObjectKey, ownerUserId, titre, description } = job.data;
    this.logger.log(`Upload YouTube pour video ${videoId} (tentative ${job.attemptsMade + 1})`);

    // Refuse toute cle hors perimetre du proprietaire (anti-exfiltration / anti-delete).
    const cle = assertCleAppartientA(sourceObjectKey, ownerUserId);

    const video = await this.db.video.findUnique({
      where: { id: videoId },
      include: {
        compteCreateur: { select: { utilisateurId: true } },
        groupeTds: { select: { tuteurId: true } },
      },
    });
    if (!video) {
      this.logger.warn(`Video ${videoId} introuvable — job ignore`);
      return;
    }
    const proprietaireVideo =
      video.compteCreateur?.utilisateurId ?? video.groupeTds?.tuteurId ?? null;
    if (!proprietaireVideo || proprietaireVideo !== ownerUserId) {
      throw new Error(
        `Refus upload YouTube : ownerUserId (${ownerUserId}) ne correspond pas au proprietaire video`,
      );
    }

    const media = await this.storage.flux('resources', cle);
    const youtubeId = await this.youtube.uploaderVideo({ titre, description, media });

    await this.db.video.update({ where: { id: videoId }, data: { youtubeId } });
    // Nettoyage uniquement de la cle appartenant au proprietaire.
    await this.storage.supprimer('resources', cle).catch((e) => {
      this.logger.warn(`Nettoyage source echoue (${cle}): ${(e as Error).message}`);
    });
  }
}
