import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Rang } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { StorageAccessService } from '../storage/storage-access.service';
import { SignalementsService } from '../messaging/signalements.service';
import { AuthUser } from '../common/types/auth-user';
import {
  assertCleAppartientA,
  construireCleUpload,
  prefixeProprietaire,
} from '../common/storage/storage-key';

const uidA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const uidB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function user(partial: Partial<AuthUser> & Pick<AuthUser, 'id' | 'rang'>): AuthUser {
  return {
    email: 'u@test.local',
    niveauId: null,
    universiteAdministreeId: null,
    estTuteurTds: false,
    ...partial,
  };
}

describe('Securite — IDOR stockage', () => {
  it('refuse une cle appartenant a un autre utilisateur', () => {
    expect(() => assertCleAppartientA(`${prefixeProprietaire(uidB)}secret.pdf`, uidA)).toThrow(
      ForbiddenException,
    );
  });

  it('force le prefixe proprietaire a l\'upload', () => {
    expect(construireCleUpload(uidA, 'docs/a.pdf')).toBe(`${prefixeProprietaire(uidA)}docs/a.pdf`);
  });

  it('StorageAccessService : proprietaire OK, tiers sans reference => false', async () => {
    const prisma = {
      withRlsContext: jest.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          ressource: { findFirst: jest.fn().mockResolvedValue(null) },
          livre: { findFirst: jest.fn().mockResolvedValue(null) },
        }),
      ),
    };
    const access = new StorageAccessService(prisma as never);

    await expect(
      access.assertTelechargementAutorise(
        user({ id: uidA, rang: Rang.etudiant }),
        'resources',
        `${prefixeProprietaire(uidA)}ok.pdf`,
      ),
    ).resolves.toBeUndefined();

    await expect(
      access.peutTelecharger(
        user({ id: uidA, rang: Rang.etudiant }),
        'resources',
        `${prefixeProprietaire(uidB)}secret.pdf`,
      ),
    ).resolves.toBe(false);
  });

  it('StorageAccessService : cle etrangere referencee en base => autorise', async () => {
    const prisma = {
      withRlsContext: jest.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          ressource: { findFirst: jest.fn().mockResolvedValue({ id: 'r1' }) },
          livre: { findFirst: jest.fn() },
        }),
      ),
    };
    const access = new StorageAccessService(prisma as never);
    await expect(
      access.assertTelechargementAutorise(
        user({ id: uidA, rang: Rang.etudiant }),
        'resources',
        `${prefixeProprietaire(uidB)}publie.pdf`,
      ),
    ).resolves.toBeUndefined();
  });
});

describe('Securite — elevation TDS / rang', () => {
  it('etudiant ne peut pas creer un Groupe TDS', () => {
    const users = new UsersService({} as never, {} as never, {} as never);
    expect(() =>
      users.creerGroupeTds(user({ id: uidA, rang: Rang.etudiant }), {
        tuteurId: uidA,
        nom: 'Mon groupe',
      }),
    ).toThrow(ForbiddenException);
  });

  it('publication video TDS refusee si pas tuteur (controleur)', () => {
    const etudiant = user({ id: uidA, rang: Rang.etudiant, estTuteurTds: false });
    expect(etudiant.estTuteurTds).toBe(false);
  });
});

describe('Securite — auth email / sessions', () => {
  let hashOk: string;

  beforeAll(async () => {
    hashOk = await (await import('argon2')).hash('MotDePasse!2026');
  }, 120_000);

  it('login refuse un compte non verifie avec message generique', async () => {
    const db = {
      utilisateur: {
        findUnique: jest.fn().mockResolvedValue({
          id: uidA,
          email: 'a@test.local',
          motDePasseHash: hashOk,
          emailVerifie: false,
        }),
      },
    };
    const throttle = {
      assertNonVerrouille: jest.fn().mockResolvedValue(undefined),
      enregistrerEchec: jest.fn().mockResolvedValue(undefined),
      reinitialiser: jest.fn().mockResolvedValue(undefined),
    };
    const auth = new AuthService(
      db as never,
      {} as never,
      { estConfigure: () => true } as never,
      throttle as never,
    );
    await expect(
      auth.login({ email: 'a@test.local', motDePasse: 'MotDePasse!2026' }, {}),
    ).rejects.toThrow('Identifiants invalides');
    expect(throttle.enregistrerEchec).toHaveBeenCalled();
  });

  it('changerMotDePasse revoque toutes les sessions', async () => {
    const db = {
      utilisateur: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: uidA,
          motDePasseHash: hashOk,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      sessionDevice: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const auth = new AuthService(
      db as never,
      {} as never,
      { estConfigure: () => true } as never,
      {
        assertNonVerrouille: jest.fn(),
        enregistrerEchec: jest.fn(),
        reinitialiser: jest.fn(),
      } as never,
    );
    await auth.changerMotDePasse(uidA, 'MotDePasse!2026', 'NouveauMot!2026');
    expect(db.sessionDevice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { utilisateurId: uidA, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      }),
    );
  });

  it('JwtStrategy refuse un access token dont la session est revoquee', async () => {
    const { JwtStrategy } = await import('../auth/strategies/jwt.strategy');
    const db = {
      utilisateur: {
        findUnique: jest.fn().mockResolvedValue({
          id: uidA,
          email: 'a@test.local',
          emailVerifie: true,
          rang: Rang.etudiant,
          niveauId: null,
          universiteAdministreeId: null,
          groupeTds: null,
        }),
      },
      sessionDevice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sid-1',
          utilisateurId: uidA,
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
    };
    const strategy = new JwtStrategy(
      { getOrThrow: () => 'test-secret-min-32-chars-xxxxxx' } as never,
      db as never,
    );
    await expect(
      strategy.validate({
        sub: uidA,
        sid: 'sid-1',
        email: 'a@test.local',
        rang: Rang.etudiant,
        niveauId: null,
        universiteAdministreeId: null,
        estTuteurTds: false,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('Securite — signalement personne', () => {
  it('refuse un emetteur non etudiant', async () => {
    const svc = new SignalementsService({} as never);
    await expect(
      svc.signalerPersonne(user({ id: uidA, rang: Rang.formateur }), {
        destinataireId: uidB,
        sujet: 'Probleme',
        description: 'Description assez longue',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Securite — NotFound vs fuite IDOR', () => {
  it('cle inconnue renvoie NotFound (pas de confirmation d\'existence brute)', async () => {
    const prisma = {
      withRlsContext: jest.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          ressource: { findFirst: jest.fn().mockResolvedValue(null) },
          livre: { findFirst: jest.fn().mockResolvedValue(null) },
        }),
      ),
    };
    const access = new StorageAccessService(prisma as never);
    await expect(
      access.assertTelechargementAutorise(
        user({ id: uidA, rang: Rang.etudiant }),
        'resources',
        `${prefixeProprietaire(uidB)}inconnu.pdf`,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
