-- ============================================================================
-- Sprint 2 securite : durcissement RLS + colonnes verification email
-- ============================================================================

ALTER TABLE "Utilisateur"
  ADD COLUMN IF NOT EXISTS "emailVerificationTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- Empêche l'auto-escalade via UPDATE sur universe_app (rang, email, hash, …).
-- AuthDb / SystemPrisma (role owner) ne sont pas bloques.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_guard_utilisateur_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user <> 'universe_app' THEN
    RETURN NEW;
  END IF;

  IF app_est_superadmin() THEN
    RETURN NEW;
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id" THEN
    RAISE EXCEPTION 'Modification de id interdite';
  END IF;

  IF NEW."rang" IS DISTINCT FROM OLD."rang"
     OR NEW."email" IS DISTINCT FROM OLD."email"
     OR NEW."motDePasseHash" IS DISTINCT FROM OLD."motDePasseHash"
     OR NEW."emailVerifie" IS DISTINCT FROM OLD."emailVerifie"
     OR NEW."emailVerificationTokenHash" IS DISTINCT FROM OLD."emailVerificationTokenHash"
     OR NEW."emailVerificationExpiresAt" IS DISTINCT FROM OLD."emailVerificationExpiresAt"
     OR NEW."universiteAdministreeId" IS DISTINCT FROM OLD."universiteAdministreeId"
  THEN
    RAISE EXCEPTION 'Modification de champs privilegies interdite (passez par Auth/Superadmin)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_utilisateur_update ON "Utilisateur";
CREATE TRIGGER trg_guard_utilisateur_update
  BEFORE UPDATE ON "Utilisateur"
  FOR EACH ROW
  EXECUTE PROCEDURE app_guard_utilisateur_update();

-- ---------------------------------------------------------------------------
-- Notifications : plus d'INSERT via universe_app (anti-spam).
-- Creation via role owner (SystemPrismaService).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "notification_insert" ON "Notification";

-- ---------------------------------------------------------------------------
-- Video UPDATE : WITH CHECK aligne sur USING
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "video_update" ON "Video";
CREATE POLICY "video_update" ON "Video" FOR UPDATE
    USING (
        app_est_superadmin()
        OR ("compteCreateurId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "CompteCreateur" cc
            WHERE cc."id" = "compteCreateurId" AND cc."utilisateurId" = app_uid()))
        OR ("groupeTdsId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "GroupeTds" g
            WHERE g."id" = "groupeTdsId" AND g."tuteurId" = app_uid()))
        OR ("compteCreateurId" IS NOT NULL AND app_est_admin_de(fn_univ_de_createur_video("id")))
    )
    WITH CHECK (
        app_est_superadmin()
        OR ("compteCreateurId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "CompteCreateur" cc
            WHERE cc."id" = "compteCreateurId" AND cc."utilisateurId" = app_uid()))
        OR ("groupeTdsId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "GroupeTds" g
            WHERE g."id" = "groupeTdsId" AND g."tuteurId" = app_uid()))
        OR ("compteCreateurId" IS NOT NULL AND app_est_admin_de(fn_univ_de_createur_video("id")))
    );

-- ---------------------------------------------------------------------------
-- Abonnements / likes : lecture limitee au proprietaire
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "abonnement_select" ON "Abonnement";
CREATE POLICY "abonnement_select" ON "Abonnement" FOR SELECT
    USING ("utilisateurId" = app_uid() OR app_est_superadmin());

DROP POLICY IF EXISTS "abonnement_tds_select" ON "AbonnementTds";
CREATE POLICY "abonnement_tds_select" ON "AbonnementTds" FOR SELECT
    USING ("utilisateurId" = app_uid() OR app_est_superadmin());

DROP POLICY IF EXISTS "like_select" ON "LikeVideo";
CREATE POLICY "like_select" ON "LikeVideo" FOR SELECT
    USING ("utilisateurId" = app_uid() OR app_est_superadmin());
