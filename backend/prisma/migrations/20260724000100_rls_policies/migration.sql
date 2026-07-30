-- ============================================================================
-- UniVerse - Row Level Security (cf. cahier 4.4, 8.2)
-- Seconde couche de defense (la premiere etant les Guards NestJS).
-- Principe : "lecture ouverte / ecriture scopee".
--
-- L'API se connecte avec le role NON superuser `universe_app` ; chaque requete
-- protegee positionne app.current_user_id / app.current_rang via SET LOCAL
-- (voir PrismaService.withRlsContext). Les helpers de navigation sont en
-- SECURITY DEFINER pour eviter toute recursion de policy.
-- ============================================================================

-- Filet de securite : cree le role applicatif s'il n'existe pas encore
-- (en prod il est cree par docker/postgres/init/01-init-app-role.sh).
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'universe_app') THEN
        CREATE ROLE universe_app LOGIN PASSWORD 'change_me_app_password';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO universe_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO universe_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO universe_app;

-- Le role applicatif ne doit pas acceder a la table interne de Prisma.
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_prisma_migrations') THEN
        REVOKE ALL ON "_prisma_migrations" FROM universe_app;
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Helpers d'identite (lisent les GUC positionnes par l'API)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_uid() RETURNS text
    LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.current_user_id', true), '') $$;

CREATE OR REPLACE FUNCTION app_rang() RETURNS text
    LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.current_rang', true), '') $$;

CREATE OR REPLACE FUNCTION app_rang_ordre(r text) RETURNS int
    LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE r
        WHEN 'etudiant' THEN 0
        WHEN 'formateur' THEN 1
        WHEN 'enseignant' THEN 2
        WHEN 'moderateur' THEN 3
        WHEN 'admin_universite' THEN 4
        WHEN 'superadmin' THEN 5
        ELSE -1
    END
$$;

-- Capacites de CONTENU uniquement (jamais pour la messagerie, cf. 4.4).
CREATE OR REPLACE FUNCTION app_rang_au_moins(minr text) RETURNS boolean
    LANGUAGE sql STABLE AS $$
    SELECT app_rang() IS NOT NULL AND app_rang_ordre(app_rang()) >= app_rang_ordre(minr)
$$;

CREATE OR REPLACE FUNCTION app_est_superadmin() RETURNS boolean
    LANGUAGE sql STABLE AS $$ SELECT app_rang() = 'superadmin' $$;

CREATE OR REPLACE FUNCTION app_est_authentifie() RETURNS boolean
    LANGUAGE sql STABLE AS $$ SELECT app_uid() IS NOT NULL $$;

-- Vrai si l'utilisateur courant est l'Admin de l'universite `univ` (ou Superadmin).
CREATE OR REPLACE FUNCTION app_est_admin_de(univ text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT app_est_superadmin() OR EXISTS (
        SELECT 1 FROM "Utilisateur" u
        WHERE u."id" = app_uid()
          AND u."rang" = 'admin_universite'
          AND u."universiteAdministreeId" = univ
    )
$$;

CREATE OR REPLACE FUNCTION app_est_tuteur(uid text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (SELECT 1 FROM "GroupeTds" g WHERE g."tuteurId" = uid)
$$;

-- ---------------------------------------------------------------------------
-- Helpers de navigation hierarchique (SECURITY DEFINER => contournent la RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_univ_de_faculte(fid text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT "universiteId" FROM "Faculte" WHERE "id" = fid
$$;

CREATE OR REPLACE FUNCTION fn_univ_de_filiere(fid text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT fn_univ_de_faculte("faculteId") FROM "Filiere" WHERE "id" = fid
$$;

CREATE OR REPLACE FUNCTION fn_univ_de_niveau(nid text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT fn_univ_de_filiere("filiereId") FROM "NiveauEtude" WHERE "id" = nid
$$;

CREATE OR REPLACE FUNCTION fn_univ_de_matiere(mid text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT fn_univ_de_niveau("niveauId") FROM "Matiere" WHERE "id" = mid
$$;

CREATE OR REPLACE FUNCTION fn_univ_de_canal(cid text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT fn_univ_de_matiere("matiereId") FROM "Canal" WHERE "id" = cid
$$;

-- Universite deduite du createur d'une video (cf. masquage 4.4).
CREATE OR REPLACE FUNCTION fn_univ_de_createur_video(vid text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT fn_univ_de_niveau(u."niveauId")
    FROM "Video" v
    JOIN "CompteCreateur" cc ON cc."id" = v."compteCreateurId"
    JOIN "Utilisateur" u ON u."id" = cc."utilisateurId"
    WHERE v."id" = vid
$$;

-- Vrai si `uid` est moderateur assigne au canal `cid` (cf. Attribution_Moderateur).
CREATE OR REPLACE FUNCTION fn_est_moderateur_du_canal(cid text, uid text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM "AttributionModerateur" a
        WHERE a."canalId" = cid AND a."moderateurId" = uid
    )
$$;

-- Canal auquel une ressource est rattachee.
CREATE OR REPLACE FUNCTION fn_canal_de_ressource(rid text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT "canalId" FROM "Ressource" WHERE "id" = rid
$$;

-- ===========================================================================
-- Activation RLS + policies, table par table
-- ===========================================================================

-- --- Utilisateur : profils consultables ; ecriture = soi-meme / superadmin ---
ALTER TABLE "Utilisateur" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "utilisateur_select" ON "Utilisateur" FOR SELECT
    USING (app_est_authentifie());
CREATE POLICY "utilisateur_update" ON "Utilisateur" FOR UPDATE
    USING ("id" = app_uid() OR app_est_superadmin())
    WITH CHECK ("id" = app_uid() OR app_est_superadmin());
CREATE POLICY "utilisateur_delete" ON "Utilisateur" FOR DELETE
    USING (app_est_superadmin());
-- INSERT (inscription) passe par le role owner (AuthDbService) : pas de policy INSERT.

-- --- Universite : lecture des actives (sauf Superadmin) ; ecriture Superadmin ---
ALTER TABLE "Universite" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "universite_select" ON "Universite" FOR SELECT
    USING (app_est_authentifie() AND ("statut" = 'actif' OR app_est_superadmin()));
CREATE POLICY "universite_write" ON "Universite" FOR ALL
    USING (app_est_superadmin())
    WITH CHECK (app_est_superadmin());

-- --- Faculte : lecture ouverte ; ecriture Admin de l'universite / Superadmin ---
ALTER TABLE "Faculte" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faculte_select" ON "Faculte" FOR SELECT USING (app_est_authentifie());
CREATE POLICY "faculte_write" ON "Faculte" FOR ALL
    USING (app_est_admin_de("universiteId"))
    WITH CHECK (app_est_admin_de("universiteId"));

-- --- Filiere ---
ALTER TABLE "Filiere" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "filiere_select" ON "Filiere" FOR SELECT USING (app_est_authentifie());
CREATE POLICY "filiere_write" ON "Filiere" FOR ALL
    USING (app_est_admin_de(fn_univ_de_faculte("faculteId")))
    WITH CHECK (app_est_admin_de(fn_univ_de_faculte("faculteId")));

-- --- NiveauEtude ---
ALTER TABLE "NiveauEtude" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "niveau_select" ON "NiveauEtude" FOR SELECT USING (app_est_authentifie());
CREATE POLICY "niveau_write" ON "NiveauEtude" FOR ALL
    USING (app_est_admin_de(fn_univ_de_filiere("filiereId")))
    WITH CHECK (app_est_admin_de(fn_univ_de_filiere("filiereId")));

-- --- Matiere ---
ALTER TABLE "Matiere" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matiere_select" ON "Matiere" FOR SELECT USING (app_est_authentifie());
CREATE POLICY "matiere_write" ON "Matiere" FOR ALL
    USING (app_est_admin_de(fn_univ_de_niveau("niveauId")))
    WITH CHECK (app_est_admin_de(fn_univ_de_niveau("niveauId")));

-- --- Canal ---
ALTER TABLE "Canal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "canal_select" ON "Canal" FOR SELECT USING (app_est_authentifie());
CREATE POLICY "canal_write" ON "Canal" FOR ALL
    USING (app_est_admin_de(fn_univ_de_matiere("matiereId")))
    WITH CHECK (app_est_admin_de(fn_univ_de_matiere("matiereId")));

-- --- Attribution_Moderateur : lecture ouverte ; ecriture Admin de l'univ ---
ALTER TABLE "AttributionModerateur" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attribution_select" ON "AttributionModerateur" FOR SELECT USING (app_est_authentifie());
CREATE POLICY "attribution_write" ON "AttributionModerateur" FOR ALL
    USING (app_est_admin_de(fn_univ_de_canal("canalId")))
    WITH CHECK (app_est_admin_de(fn_univ_de_canal("canalId")));

-- --- Ressource : lecture ouverte ; ecriture = moderateur assigne au canal ---
ALTER TABLE "Ressource" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ressource_select" ON "Ressource" FOR SELECT USING (app_est_authentifie());
CREATE POLICY "ressource_insert" ON "Ressource" FOR INSERT
    WITH CHECK (
        "auteurId" = app_uid()
        AND (fn_est_moderateur_du_canal("canalId", app_uid()) OR app_est_admin_de(fn_univ_de_canal("canalId")))
    );
CREATE POLICY "ressource_update" ON "Ressource" FOR UPDATE
    USING ("auteurId" = app_uid() OR app_est_admin_de(fn_univ_de_canal("canalId")))
    WITH CHECK ("auteurId" = app_uid() OR app_est_admin_de(fn_univ_de_canal("canalId")));

-- --- Message : discussions ouvertes en lecture ; conversations = participants ---
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "message_select" ON "Message" FOR SELECT
    USING (
        app_est_authentifie() AND (
            "ressourceId" IS NOT NULL -- fil de ressource : lecture ouverte
            OR EXISTS (
                SELECT 1 FROM "Conversation" c
                WHERE c."id" = "conversationId"
                  AND (c."utilisateurUnId" = app_uid() OR c."utilisateurDeuxId" = app_uid())
            )
        )
    );
CREATE POLICY "message_insert" ON "Message" FOR INSERT
    WITH CHECK (
        "auteurId" = app_uid() AND (
            "ressourceId" IS NOT NULL
            OR EXISTS (
                SELECT 1 FROM "Conversation" c
                WHERE c."id" = "conversationId"
                  AND (c."utilisateurUnId" = app_uid() OR c."utilisateurDeuxId" = app_uid())
                  AND c."statut" = 'ouverte'
            )
        )
    );
CREATE POLICY "message_update" ON "Message" FOR UPDATE
    USING ("auteurId" = app_uid())
    WITH CHECK ("auteurId" = app_uid());

-- --- Demande_Statut : le demandeur voit les siennes ; decision = Superadmin ---
ALTER TABLE "DemandeStatut" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demande_select" ON "DemandeStatut" FOR SELECT
    USING ("demandeurId" = app_uid() OR app_est_superadmin());
CREATE POLICY "demande_insert" ON "DemandeStatut" FOR INSERT
    WITH CHECK ("demandeurId" = app_uid());
CREATE POLICY "demande_update" ON "DemandeStatut" FOR UPDATE
    USING (app_est_superadmin())
    WITH CHECK (app_est_superadmin());

-- --- Compte_Createur : lecture ouverte ; ecriture soi-meme (rang >= formateur) ---
ALTER TABLE "CompteCreateur" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compte_createur_select" ON "CompteCreateur" FOR SELECT USING (app_est_authentifie());
CREATE POLICY "compte_createur_write" ON "CompteCreateur" FOR ALL
    USING ("utilisateurId" = app_uid() OR app_est_superadmin())
    WITH CHECK (
        ("utilisateurId" = app_uid() AND app_rang_au_moins('formateur'))
        OR app_est_superadmin()
    );

-- --- Video : lecture ouverte (masquage + exclusion TDS) ; ecriture scopee ---
ALTER TABLE "Video" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_select" ON "Video" FOR SELECT
    USING (
        app_est_authentifie()
        -- masquage : cachee sauf proprietaire / admin de l'univ du createur / superadmin
        AND (
            "estMasquee" = false
            OR app_est_superadmin()
            OR ("compteCreateurId" IS NOT NULL AND app_est_admin_de(fn_univ_de_createur_video("id")))
        )
        -- exclusion TDS : videos de groupe TDS invisibles aux formateurs/enseignants
        -- (visibles aux etudiants, moderateurs, admins, superadmin, tuteurs) cf. TDS-2/TDS-4
        AND (
            "groupeTdsId" IS NULL
            OR app_rang() IN ('etudiant', 'moderateur', 'admin_universite', 'superadmin')
            OR app_est_tuteur(app_uid())
        )
    );
-- Ecriture video via Compte_Createur (rang >= formateur) : le service verifie
-- la propriete ; la policy exige un rang createur ou un groupe TDS possede.
CREATE POLICY "video_insert" ON "Video" FOR INSERT
    WITH CHECK (
        (
            "compteCreateurId" IS NOT NULL
            AND app_rang_au_moins('formateur')
            AND EXISTS (
                SELECT 1 FROM "CompteCreateur" cc
                WHERE cc."id" = "compteCreateurId" AND cc."utilisateurId" = app_uid()
            )
        )
        OR (
            "groupeTdsId" IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM "GroupeTds" g
                WHERE g."id" = "groupeTdsId" AND g."tuteurId" = app_uid()
            )
        )
        OR app_est_superadmin()
    );
CREATE POLICY "video_update" ON "Video" FOR UPDATE
    USING (
        app_est_superadmin()
        OR ("compteCreateurId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "CompteCreateur" cc
            WHERE cc."id" = "compteCreateurId" AND cc."utilisateurId" = app_uid()))
        OR ("groupeTdsId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "GroupeTds" g
            WHERE g."id" = "groupeTdsId" AND g."tuteurId" = app_uid()))
        -- masquage d'urgence par l'Admin de l'universite du createur (AU-9)
        OR ("compteCreateurId" IS NOT NULL AND app_est_admin_de(fn_univ_de_createur_video("id")))
    )
    WITH CHECK (true);

-- --- Abonnement : chacun gere ses abonnements ---
ALTER TABLE "Abonnement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "abonnement_select" ON "Abonnement" FOR SELECT
    USING ("utilisateurId" = app_uid() OR app_est_authentifie());
CREATE POLICY "abonnement_write" ON "Abonnement" FOR ALL
    USING ("utilisateurId" = app_uid())
    WITH CHECK ("utilisateurId" = app_uid());

-- --- Abonnement_TDS ---
ALTER TABLE "AbonnementTds" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "abonnement_tds_select" ON "AbonnementTds" FOR SELECT
    USING ("utilisateurId" = app_uid() OR app_est_authentifie());
CREATE POLICY "abonnement_tds_write" ON "AbonnementTds" FOR ALL
    USING ("utilisateurId" = app_uid())
    WITH CHECK ("utilisateurId" = app_uid());

-- --- Notification : strictement le destinataire ---
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_select" ON "Notification" FOR SELECT
    USING ("destinataireId" = app_uid());
CREATE POLICY "notification_update" ON "Notification" FOR UPDATE
    USING ("destinataireId" = app_uid())
    WITH CHECK ("destinataireId" = app_uid());
-- INSERT via services (job/notif) : autorise si destinataire renseigne.
CREATE POLICY "notification_insert" ON "Notification" FOR INSERT
    WITH CHECK (app_est_authentifie());

-- --- Session/Device : aucun acces au role applicatif (gere par owner/auth) ---
ALTER TABLE "SessionDevice" ENABLE ROW LEVEL SECURITY;
-- Pas de policy => refus par defaut pour universe_app.

-- --- Groupe_TDS : lecture ouverte ; ecriture tuteur / superadmin ---
ALTER TABLE "GroupeTds" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groupe_tds_select" ON "GroupeTds" FOR SELECT USING (app_est_authentifie());
CREATE POLICY "groupe_tds_write" ON "GroupeTds" FOR ALL
    USING ("tuteurId" = app_uid() OR app_est_superadmin())
    WITH CHECK ("tuteurId" = app_uid() OR app_est_superadmin());

-- --- Conversation : uniquement les deux participants ---
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversation_select" ON "Conversation" FOR SELECT
    USING ("utilisateurUnId" = app_uid() OR "utilisateurDeuxId" = app_uid());
CREATE POLICY "conversation_insert" ON "Conversation" FOR INSERT
    WITH CHECK ("utilisateurUnId" = app_uid() OR "utilisateurDeuxId" = app_uid());
CREATE POLICY "conversation_update" ON "Conversation" FOR UPDATE
    USING ("utilisateurUnId" = app_uid() OR "utilisateurDeuxId" = app_uid())
    WITH CHECK ("utilisateurUnId" = app_uid() OR "utilisateurDeuxId" = app_uid());

-- --- Signalement : emetteur + destinataire/traitant ---
ALTER TABLE "Signalement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signalement_select" ON "Signalement" FOR SELECT
    USING (
        "emetteurId" = app_uid()
        OR "destinataireId" = app_uid()
        OR "traiteParId" = app_uid()
        OR app_est_superadmin()
    );
CREATE POLICY "signalement_insert" ON "Signalement" FOR INSERT
    WITH CHECK ("emetteurId" = app_uid());
CREATE POLICY "signalement_update" ON "Signalement" FOR UPDATE
    USING ("destinataireId" = app_uid() OR "traiteParId" = app_uid() OR app_est_superadmin())
    WITH CHECK ("destinataireId" = app_uid() OR "traiteParId" = app_uid() OR app_est_superadmin());

-- --- Livre : lecture ouverte (non archives) ; ecriture rang >= admin_universite ---
ALTER TABLE "Livre" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "livre_select" ON "Livre" FOR SELECT
    USING (app_est_authentifie() AND ("estArchive" = false OR app_rang_au_moins('admin_universite')));
CREATE POLICY "livre_insert" ON "Livre" FOR INSERT
    WITH CHECK ("ajouteParId" = app_uid() AND app_rang_au_moins('admin_universite'));
-- Modification/archivage : seulement l'Admin qui a ajoute le livre, ou Superadmin (AU-7/AU-8).
CREATE POLICY "livre_update" ON "Livre" FOR UPDATE
    USING ("ajouteParId" = app_uid() OR app_est_superadmin())
    WITH CHECK ("ajouteParId" = app_uid() OR app_est_superadmin());

-- --- Like_Video : chacun gere ses likes ---
ALTER TABLE "LikeVideo" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "like_select" ON "LikeVideo" FOR SELECT
    USING ("utilisateurId" = app_uid() OR app_est_authentifie());
CREATE POLICY "like_write" ON "LikeVideo" FOR ALL
    USING ("utilisateurId" = app_uid())
    WITH CHECK ("utilisateurId" = app_uid());

-- ---------------------------------------------------------------------------
-- Privileges par defaut pour les objets futurs crees par le role owner
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO universe_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO universe_app;
