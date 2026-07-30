-- ============================================================================
-- Sprint High : restreindre les colonnes sensibles de Utilisateur pour universe_app
-- AuthDb / SystemPrisma (role owner) conservent l'acces complet.
-- ============================================================================

-- Lecture : hashes / jetons email inaccessibles au role applicatif.
REVOKE SELECT (
  "motDePasseHash",
  "emailVerificationTokenHash",
  "emailVerificationExpiresAt"
) ON TABLE "Utilisateur" FROM universe_app;

-- Ecriture : secrets et verification email uniquement via AuthDb (owner).
-- rang / universiteAdministreeId restent updatable (promotion Superadmin + trigger).
REVOKE UPDATE (
  "motDePasseHash",
  "emailVerificationTokenHash",
  "emailVerificationExpiresAt",
  "emailVerifie",
  "email"
) ON TABLE "Utilisateur" FROM universe_app;
