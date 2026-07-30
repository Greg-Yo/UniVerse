-- ============================================================================
-- Sprint Medium : FORCE RLS (tables metier), notif in-TX, garde role app
-- ============================================================================

-- ---------------------------------------------------------------------------
-- M6 : FORCE ROW LEVEL SECURITY sur les tables metier critiques.
-- Le role owner superuser (DIRECT_URL) contourne toujours via BYPASSRLS.
-- Cela empeche un role table-owner non-bypass de lire sans policy.
-- ---------------------------------------------------------------------------
ALTER TABLE "Utilisateur" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SessionDevice" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Ressource" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Video" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Livre" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Message" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Signalement" FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- M7 : ne plus creer universe_app avec un secret faible dans les migrations.
-- Si le role manque, on echoue explicitement (init Docker doit l'avoir cree).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'universe_app') THEN
    RAISE EXCEPTION
      'Role universe_app manquant. Creez-le via docker/postgres/init (APP_DB_PASSWORD), pas via une migration.';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- M10 : creation de notification dans la meme transaction RLS (SECURITY DEFINER).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_creer_notification(
  p_destinataire_id text,
  p_type "TypeNotification",
  p_payload jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_destinataire_id IS NULL OR length(p_destinataire_id) < 1 THEN
    RAISE EXCEPTION 'destinataire invalide';
  END IF;
  INSERT INTO "Notification" ("id", "destinataireId", "type", "payload", "lu", "createdAt")
  VALUES (gen_random_uuid()::text, p_destinataire_id, p_type, p_payload, false, NOW());
END;
$$;

REVOKE ALL ON FUNCTION app_creer_notification(text, "TypeNotification", jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_creer_notification(text, "TypeNotification", jsonb) TO universe_app;
