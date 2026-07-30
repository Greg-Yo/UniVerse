import { PASSWORD_REGEX } from './password';

describe('password policy', () => {
  it('accepte un mot de passe conforme', () => {
    expect(PASSWORD_REGEX.test('MotDePasse!2026')).toBe(true);
  });

  it('rejette trop court / sans symbole / sans majuscule', () => {
    expect(PASSWORD_REGEX.test('Court!1a')).toBe(false);
    expect(PASSWORD_REGEX.test('MotDePasse2026')).toBe(false);
    expect(PASSWORD_REGEX.test('motdepasse!2026')).toBe(false);
  });
});
