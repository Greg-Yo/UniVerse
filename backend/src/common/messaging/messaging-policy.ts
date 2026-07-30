import { Rang } from '../enums/rang.enum';

export type TypeConversationPolicy = 'libre' | 'fenetre_reponse';

export type DecisionMessagerie =
  | { autorise: true; canal: 'conversation'; type: TypeConversationPolicy }
  | { autorise: false; canal: 'signalement'; raison: string }
  | { autorise: false; canal: 'interdit'; raison: string };

interface ProfilMessagerie {
  rang: Rang;
  estTuteurTds?: boolean;
}

/**
 * Encode la matrice de messagerie directe de la section 3.8 du cahier.
 *
 * Regle d'or (cf. 3.8 et point de vigilance 4.4) : ces regles ne suivent PAS
 * l'heritage de la chaine 4.1. Chaque decision teste le rang EXACT de
 * l'expediteur et du destinataire. Ne jamais deriver ces regles d'un `rang >= X`.
 *
 * - Conversation = messagerie classique bidirectionnelle (cas par defaut).
 * - Signalement = flux asynchrone, EXCEPTION reservee a Etudiant -> Moderateur
 *   et Etudiant -> Admin Universite (cf. AU-5 / MOD-6 / ET-13).
 * - Fenetre 24h = uniquement pour un message entrant Etudiant -> Enseignant (EN-3).
 */
export class MessagingPolicy {
  /**
   * Decision pour la CREATION d'un echange direct par `expediteur` vers
   * `destinataire` (l'initiateur compte, cf. droit d'initiation large EN-3).
   */
  static resoudreCreation(
    expediteur: ProfilMessagerie,
    destinataire: ProfilMessagerie,
  ): DecisionMessagerie {
    const de = expediteur.rang;
    const vers = destinataire.rang;

    // --- Exceptions explicites cote Etudiant (ne suivent pas la chaine) ---
    if (de === Rang.etudiant) {
      if (vers === Rang.moderateur || vers === Rang.admin_universite) {
        return {
          autorise: false,
          canal: 'signalement',
          raison:
            'Un etudiant ne peut contacter un moderateur/admin que par signalement (cf. 3.8, ET-14).',
        };
      }
      if (vers === Rang.superadmin) {
        return {
          autorise: false,
          canal: 'interdit',
          raison: 'Aucun canal direct vers le Superadmin (cf. 3.8).',
        };
      }
      if (vers === Rang.enseignant) {
        // Fil soumis a la fenetre de reponse 24h (EN-3).
        return { autorise: true, canal: 'conversation', type: 'fenetre_reponse' };
      }
      if (vers === Rang.etudiant || vers === Rang.formateur) {
        return { autorise: true, canal: 'conversation', type: 'libre' };
      }
      return {
        autorise: false,
        canal: 'interdit',
        raison: 'Destinataire non autorise pour un etudiant (cf. 3.8).',
      };
    }

    // --- Enseignant : droit d'initiation large vers tout compte (EN-3) ---
    if (de === Rang.enseignant) {
      return { autorise: true, canal: 'conversation', type: 'libre' };
    }

    // --- Tuteur TDS : messagerie de type createur -> audience (comme FO-2) ---
    if (expediteur.estTuteurTds) {
      if (vers === Rang.etudiant || vers === Rang.formateur || destinataire.estTuteurTds) {
        return { autorise: true, canal: 'conversation', type: 'libre' };
      }
    }

    // --- Formateur : peut echanger avec etudiants et pairs formateurs ---
    if (de === Rang.formateur) {
      if (vers === Rang.etudiant || vers === Rang.formateur) {
        return { autorise: true, canal: 'conversation', type: 'libre' };
      }
    }

    // --- Roles de gouvernance : echanges entre pairs de meme rang exact ---
    if (
      (de === Rang.moderateur && vers === Rang.moderateur) ||
      (de === Rang.admin_universite && vers === Rang.admin_universite)
    ) {
      return { autorise: true, canal: 'conversation', type: 'libre' };
    }

    return {
      autorise: false,
      canal: 'interdit',
      raison: `Messagerie directe non autorisee de ${de} vers ${vers} (cf. matrice 3.8).`,
    };
  }

  /**
   * Vrai si l'echange (une fois cree) autorise l'expediteur a publier un
   * message dans une conversation existante. Bidirectionnel par nature :
   * les deux participants peuvent ecrire tant que le fil est ouvert.
   */
  static peutPosterDansConversation(statut: 'ouverte' | 'fermee'): boolean {
    return statut === 'ouverte';
  }
}
