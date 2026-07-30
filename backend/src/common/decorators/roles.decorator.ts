import { SetMetadata } from '@nestjs/common';
import { Rang } from '../enums/rang.enum';

export const MIN_RANG_KEY = 'minRang';
export const EXACT_RANG_KEY = 'exactRang';

/**
 * Exige un rang AU MOINS egal a `rang` dans la chaine (capacites de contenu).
 * Ex. @MinRang(Rang.formateur) autorise formateur, enseignant, ... superadmin.
 */
export const MinRang = (rang: Rang) => SetMetadata(MIN_RANG_KEY, rang);

/**
 * Exige un rang EXACT (aucun heritage). A utiliser pour les regles qui ne
 * suivent pas la chaine 4.1 (ex. actions specifiques a un rang donne).
 */
export const ExactRang = (...rangs: Rang[]) => SetMetadata(EXACT_RANG_KEY, rangs);
