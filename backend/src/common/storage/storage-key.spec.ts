import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  assertCleAppartientA,
  assertCleStockageValide,
  construireCleUpload,
  prefixeProprietaire,
} from './storage-key';

describe('storage-key', () => {
  const uid = '11111111-1111-1111-1111-111111111111';

  it('accepte une cle simple', () => {
    expect(assertCleStockageValide('docs/a.pdf')).toBe('docs/a.pdf');
  });

  it('rejette le path traversal', () => {
    expect(() => assertCleStockageValide('a/../b.pdf')).toThrow(BadRequestException);
    expect(() => assertCleStockageValide('a/./b.pdf')).toThrow(BadRequestException);
  });

  it('verifie le prefixe proprietaire', () => {
    expect(assertCleAppartientA(`user/${uid}/x.pdf`, uid)).toBe(`user/${uid}/x.pdf`);
    expect(() => assertCleAppartientA(`user/other/x.pdf`, uid)).toThrow(ForbiddenException);
  });

  it('construit une cle d\'upload', () => {
    expect(construireCleUpload(uid, 'epreuves/algo.pdf')).toBe(
      `${prefixeProprietaire(uid)}epreuves/algo.pdf`,
    );
  });
});
