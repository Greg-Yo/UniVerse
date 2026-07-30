import { Rang } from '../enums/rang.enum';

/** Identite authentifiee attachee a la requete (issue du JWT). */
export interface AuthUser {
  id: string;
  email: string;
  rang: Rang;
  niveauId: string | null;
  universiteAdministreeId: string | null;
  /** Vrai si l'utilisateur est responsable d'un Groupe TDS (role hors chaine). */
  estTuteurTds: boolean;
}

/** Payload encode dans le JWT d'acces. */
export interface JwtAccessPayload {
  sub: string;
  /** SessionDevice.id — permet d'invalider l'access des le logout / revocation. */
  sid: string;
  email: string;
  rang: Rang;
  niveauId: string | null;
  universiteAdministreeId: string | null;
  estTuteurTds: boolean;
}

/** Payload encode dans le JWT de rafraichissement. */
export interface JwtRefreshPayload {
  sub: string;
  /** Identifiant de la session/device (SessionDevice.id) pour la revocation. */
  sid: string;
}
