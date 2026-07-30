/**
 * Tests e2e legers RLS : verifies que universe_app ne peut pas lire les hashes.
 * Active en CI via RUN_RLS_E2E=true apres creation du role applicatif.
 */
import { PrismaClient } from '@prisma/client';

describe('RLS e2e — colonnes sensibles Utilisateur', () => {
  const appUrl = process.env.DATABASE_URL_APP;
  const hasDb = process.env.RUN_RLS_E2E === 'true' && Boolean(appUrl);

  (hasDb ? it : it.skip)(
    'universe_app ne peut pas SELECT motDePasseHash',
    async () => {
      const app = new PrismaClient({ datasourceUrl: appUrl });
      try {
        await expect(
          app.$queryRawUnsafe('SELECT "motDePasseHash" FROM "Utilisateur" LIMIT 1'),
        ).rejects.toThrow();
      } finally {
        await app.$disconnect();
      }
    },
    30_000,
  );

  (hasDb ? it : it.skip)(
    'universe_app ne peut pas UPDATE emailVerifie',
    async () => {
      const app = new PrismaClient({ datasourceUrl: appUrl });
      try {
        await expect(
          app.$queryRawUnsafe('UPDATE "Utilisateur" SET "emailVerifie" = true WHERE false'),
        ).rejects.toThrow();
      } finally {
        await app.$disconnect();
      }
    },
    30_000,
  );
});
