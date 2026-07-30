import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { SystemPrismaService } from '../common/prisma/system-prisma.service';
import { QUEUE_COUNTERS } from './queues';

/**
 * Recalcule les compteurs denormalises a partir des tables sources
 * (Like_Video, Abonnement), en filet de securite derriere les triggers
 * atomiques (cf. 4.4 - derive silencieuse possible sous concurrence).
 */
@Processor(QUEUE_COUNTERS)
export class CountersProcessor extends WorkerHost {
  private readonly logger = new Logger(CountersProcessor.name);

  constructor(private readonly db: SystemPrismaService) {
    super();
  }

  async process(): Promise<void> {
    await this.db.$executeRawUnsafe(`
      UPDATE "Video" v
      SET "nombreLikes" = COALESCE(c.cnt, 0)
      FROM (
        SELECT "videoId", COUNT(*)::int AS cnt FROM "LikeVideo" GROUP BY "videoId"
      ) c
      WHERE c."videoId" = v."id"
        AND v."nombreLikes" <> COALESCE(c.cnt, 0)
    `);
    await this.db.$executeRawUnsafe(`
      UPDATE "Video" v SET "nombreLikes" = 0
      WHERE NOT EXISTS (SELECT 1 FROM "LikeVideo" l WHERE l."videoId" = v."id")
        AND v."nombreLikes" <> 0
    `);

    await this.db.$executeRawUnsafe(`
      UPDATE "CompteCreateur" cc
      SET "nombreAbonnes" = COALESCE(a.cnt, 0)
      FROM (
        SELECT "compteCreateurId", COUNT(*)::int AS cnt FROM "Abonnement" GROUP BY "compteCreateurId"
      ) a
      WHERE a."compteCreateurId" = cc."id"
        AND cc."nombreAbonnes" <> COALESCE(a.cnt, 0)
    `);
    await this.db.$executeRawUnsafe(`
      UPDATE "CompteCreateur" cc SET "nombreAbonnes" = 0
      WHERE NOT EXISTS (SELECT 1 FROM "Abonnement" a WHERE a."compteCreateurId" = cc."id")
        AND cc."nombreAbonnes" <> 0
    `);

    this.logger.log('Compteurs denormalises resynchronises');
  }
}
