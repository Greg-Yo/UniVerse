import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SystemPrismaService } from '../common/prisma/system-prisma.service';
import { ConversationWindowJob, QUEUE_CONVERSATION_WINDOW } from './queues';

/**
 * Ferme une conversation a fenetre de reponse si l'Enseignant n'a pas repondu
 * dans les temps (EN-3, cf. 3.6/4.4). Reversible : si `aDejaRepondu` est vrai
 * ou si la conversation a ete rouverte, le job ne ferme rien.
 */
@Processor(QUEUE_CONVERSATION_WINDOW)
export class ConversationWindowProcessor extends WorkerHost {
  private readonly logger = new Logger(ConversationWindowProcessor.name);

  constructor(private readonly db: SystemPrismaService) {
    super();
  }

  async process(job: Job<ConversationWindowJob>): Promise<void> {
    const { conversationId } = job.data;
    const conversation = await this.db.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.type !== 'fenetre_reponse') {
      return;
    }
    // Ne pas fermer si l'Enseignant a deja repondu, ou si l'echeance a bouge.
    if (conversation.aDejaRepondu) {
      return;
    }
    if (conversation.dateExpirationFenetre && conversation.dateExpirationFenetre > new Date()) {
      return; // echeance repoussee entre-temps
    }
    if (conversation.statut === 'fermee') {
      return;
    }
    await this.db.conversation.update({
      where: { id: conversationId },
      data: { statut: 'fermee' },
    });
    this.logger.debug(`Conversation ${conversationId} fermee (fenetre 24h expiree)`);
  }
}
