import { BadRequestException, ForbiddenException } from '@nestjs/common';

/** Prefixe obligatoire des objets uploades par un utilisateur. */
export function prefixeProprietaire(userId: string): string {
  return `user/${userId}/`;
}

/**
 * Valide une cle MinIO : pas de traversal, pas de segments vides / `.` / `..`,
 * alphabet restreint. Renvoie la cle normalisee (sans slash initial).
 */
export function assertCleStockageValide(cle: string): string {
  if (typeof cle !== 'string' || cle.length === 0 || cle.length > 512) {
    throw new BadRequestException('Cle de stockage invalide');
  }
  const normalisee = cle.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalisee) {
    throw new BadRequestException('Cle de stockage invalide');
  }
  if (normalisee.includes('\\') || normalisee.includes('\0')) {
    throw new BadRequestException('Cle de stockage invalide');
  }
  if (!/^[a-zA-Z0-9._/-]+$/.test(normalisee)) {
    throw new BadRequestException('Cle de stockage invalide');
  }
  const segments = normalisee.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new BadRequestException('Cle de stockage invalide (path traversal)');
  }
  return normalisee;
}

/** Exige que la cle appartienne au perimetre `user/{userId}/...`. */
export function assertCleAppartientA(cle: string, userId: string): string {
  const normalisee = assertCleStockageValide(cle);
  const prefixe = prefixeProprietaire(userId);
  if (!normalisee.startsWith(prefixe) || normalisee.length <= prefixe.length) {
    throw new ForbiddenException(
      `Cle de stockage hors perimetre (attendu: ${prefixe}...)`,
    );
  }
  return normalisee;
}

/**
 * Construit une cle d'upload sous le prefixe proprietaire.
 * `suffixe` est le chemin relatif fourni par le client (ex: epreuves/algo.pdf).
 */
export function construireCleUpload(userId: string, suffixe: string): string {
  const relatif = assertCleStockageValide(suffixe);
  // Interdit de re-imbriquer un prefixe user/ dans le suffixe.
  if (relatif.startsWith('user/')) {
    return assertCleAppartientA(relatif, userId);
  }
  return assertCleAppartientA(`${prefixeProprietaire(userId)}${relatif}`, userId);
}
