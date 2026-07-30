import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import {
  ConversationWindowJob,
  QUEUE_CONVERSATION_WINDOW,
  QUEUE_COUNTERS,
  QUEUE_YOUTUBE_UPLOAD,
  YoutubeUploadJob,
} from './queues';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(QUEUE_CONVERSATION_WINDOW) private readonly windowQueue: Queue<ConversationWindowJob>,
    @InjectQueue(QUEUE_COUNTERS) private readonly countersQueue: Queue,
    @InjectQueue(QUEUE_YOUTUBE_UPLOAD) private readonly youtubeQueue: Queue<YoutubeUploadJob>,
  ) {}

  /**
   * Planifie la fermeture d'une conversation a fenetre de reponse (EN-3) apres
   * `delayMs`. Le job est idempotent : il verifie a l'execution si l'Enseignant
   * a repondu entre-temps (cf. conversation-window.processor).
   */
  async planifierFermetureFenetre(conversationId: string, delayMs: number): Promise<void> {
    await this.windowQueue.add(
      'fermer',
      { conversationId },
      {
        delay: delayMs,
        jobId: `window:${conversationId}:${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  /** File d'attente d'upload YouTube avec retry (cf. risque quota 8.2). */
  async enfilerUploadYoutube(job: YoutubeUploadJob): Promise<void> {
    await this.youtubeQueue.add('upload', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: true,
      removeOnFail: 500,
    });
  }

  /** Resynchronise les compteurs denormalises toutes les nuits (filet, cf. 4.4/8.2). */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async planifierRecalculCompteurs(): Promise<void> {
    this.logger.log('Planification du recalcul des compteurs denormalises');
    await this.countersQueue.add('recalcul', {}, { removeOnComplete: true, removeOnFail: 10 });
  }
}
