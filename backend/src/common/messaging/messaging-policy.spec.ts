import { Rang } from '../enums/rang.enum';
import { MessagingPolicy } from './messaging-policy';

/**
 * Tests de la matrice 3.8 : chaque politique doit etre verifiee individuellement
 * sur le rang EXACT (cf. point de vigilance 8.2 - "chaque politique testee").
 */
describe('MessagingPolicy (matrice 3.8)', () => {
  const de = (rang: Rang, estTuteurTds = false) => ({ rang, estTuteurTds });

  it('Etudiant -> Etudiant : conversation libre', () => {
    const d = MessagingPolicy.resoudreCreation(de(Rang.etudiant), de(Rang.etudiant));
    expect(d).toEqual({ autorise: true, canal: 'conversation', type: 'libre' });
  });

  it('Etudiant -> Formateur : conversation libre', () => {
    const d = MessagingPolicy.resoudreCreation(de(Rang.etudiant), de(Rang.formateur));
    expect(d.autorise).toBe(true);
    expect(d).toMatchObject({ canal: 'conversation', type: 'libre' });
  });

  it('Etudiant -> Enseignant : conversation avec fenetre de reponse 24h', () => {
    const d = MessagingPolicy.resoudreCreation(de(Rang.etudiant), de(Rang.enseignant));
    expect(d).toEqual({ autorise: true, canal: 'conversation', type: 'fenetre_reponse' });
  });

  it('Etudiant -> Moderateur : signalement uniquement (pas de conversation)', () => {
    const d = MessagingPolicy.resoudreCreation(de(Rang.etudiant), de(Rang.moderateur));
    expect(d.autorise).toBe(false);
    expect(d).toMatchObject({ canal: 'signalement' });
  });

  it('Etudiant -> Admin Universite : signalement uniquement', () => {
    const d = MessagingPolicy.resoudreCreation(de(Rang.etudiant), de(Rang.admin_universite));
    expect(d).toMatchObject({ autorise: false, canal: 'signalement' });
  });

  it('Etudiant -> Superadmin : interdit', () => {
    const d = MessagingPolicy.resoudreCreation(de(Rang.etudiant), de(Rang.superadmin));
    expect(d).toMatchObject({ autorise: false, canal: 'interdit' });
  });

  it('Enseignant -> tout compte : conversation libre (droit EN-3)', () => {
    for (const cible of [Rang.etudiant, Rang.moderateur, Rang.admin_universite, Rang.superadmin]) {
      const d = MessagingPolicy.resoudreCreation(de(Rang.enseignant), de(cible));
      expect(d).toMatchObject({ autorise: true, canal: 'conversation', type: 'libre' });
    }
  });

  it('Moderateur -> Etudiant : non autorise (pas dans la matrice)', () => {
    const d = MessagingPolicy.resoudreCreation(de(Rang.moderateur), de(Rang.etudiant));
    expect(d.autorise).toBe(false);
  });

  it('Moderateur -> Moderateur : conversation libre (pairs)', () => {
    const d = MessagingPolicy.resoudreCreation(de(Rang.moderateur), de(Rang.moderateur));
    expect(d).toMatchObject({ autorise: true, canal: 'conversation' });
  });

  it('ne suit pas l\'heritage : Etudiant->Moderateur ne devient pas "libre" via un rang >=', () => {
    const d = MessagingPolicy.resoudreCreation(de(Rang.etudiant), de(Rang.moderateur));
    expect(d).not.toMatchObject({ canal: 'conversation' });
  });
});
