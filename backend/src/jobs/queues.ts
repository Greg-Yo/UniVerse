/** Noms des files BullMQ (Redis). */
export const QUEUE_CONVERSATION_WINDOW = 'conversation-window';
export const QUEUE_COUNTERS = 'counters';
export const QUEUE_YOUTUBE_UPLOAD = 'youtube-upload';

export interface ConversationWindowJob {
  conversationId: string;
}

export interface YoutubeUploadJob {
  videoId: string;
  /** Chemin/cle du fichier source a envoyer sur YouTube. */
  sourceObjectKey: string;
  /** Proprietaire attendu de la cle MinIO (prefixe user/{id}/). */
  ownerUserId: string;
  titre: string;
  description?: string;
}
