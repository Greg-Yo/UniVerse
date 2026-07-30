import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { assertCleAppartientA } from '../common/storage/storage-key';

/**
 * Autorisation telechargement MinIO (anti-IDOR) :
 * - cle sous user/{demandeur}/...
 * - ou cle referencee par une Ressource / un Livre accessible via RLS
 */
@Injectable()
export class StorageAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertTelechargementAutorise(
    user: AuthUser,
    bucket: 'resources' | 'library',
    cle: string,
  ): Promise<void> {
    try {
      assertCleAppartientA(cle, user.id);
      return;
    } catch {
      // Pas le proprietaire : reference metier requise.
    }

    const trouve = await this.prisma.withRlsContext(
      { userId: user.id, rang: user.rang },
      async (tx) => {
        if (bucket === 'resources') {
          return tx.ressource.findFirst({
            where: { fichierCle: cle, estSupprime: false },
            select: { id: true },
          });
        }
        return tx.livre.findFirst({
          where: { fichierCle: cle, estArchive: false },
          select: { id: true },
        });
      },
    );

    if (!trouve) {
      throw new NotFoundException('Objet introuvable');
    }
  }

  /** Variante booleenne pour les tests (ne leve pas NotFound). */
  async peutTelecharger(
    user: AuthUser,
    bucket: 'resources' | 'library',
    cle: string,
  ): Promise<boolean> {
    try {
      await this.assertTelechargementAutorise(user, bucket, cle);
      return true;
    } catch (e) {
      if (e instanceof ForbiddenException || e instanceof NotFoundException) {
        return false;
      }
      throw e;
    }
  }
}
