import { Rang } from '@prisma/client';

/**
 * Source unique du rang : on reutilise l'enum genere par Prisma (@prisma/client)
 * pour eviter toute divergence de type entre la base et l'application.
 *
 * Chaine de roles a heritage total (cf. cahier 4.1) :
 * Etudiant -> Formateur -> Enseignant -> Moderateur -> Admin Universite -> Superadmin.
 *
 * ATTENTION (cf. 4.4) : l'ordre ci-dessous ne sert QUE pour les capacites de
 * contenu (rang >= X). Les regles de messagerie (3.8) ne doivent JAMAIS etre
 * deduites de cet ordre : elles testent le rang EXACT (voir MessagingPolicy).
 * Le Tuteur TDS est hors chaine : il n'a pas de position dans cet ordre.
 */
export { Rang };

/** Rang informatif hors chaine, non ordonnable (cf. 3.7). */
export const RANG_TUTEUR_TDS = 'tuteur_tds';

/** Position dans la chaine (plus grand = plus de capacites de contenu). */
export const RANG_ORDRE: Record<Rang, number> = {
  etudiant: 0,
  formateur: 1,
  enseignant: 2,
  moderateur: 3,
  admin_universite: 4,
  superadmin: 5,
};

/**
 * Vrai si `rang` atteint au moins `minimum` dans la chaine (capacites de contenu).
 * Ne doit pas etre utilise pour les regles de messagerie.
 */
export function rangAuMoins(rang: Rang, minimum: Rang): boolean {
  return RANG_ORDRE[rang] >= RANG_ORDRE[minimum];
}
