-- ============================================================================
-- UniVerse - Migration initiale : 22 entites (cahier section 4.2)
-- Contraintes CHECK d'exclusivite, triggers de compteurs denormalises,
-- et trigger de contrainte moderateur mono-universite (cf. 4.4).
-- Les identifiants suivent la convention Prisma par defaut (guillemets).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE "Rang" AS ENUM ('etudiant', 'formateur', 'enseignant', 'moderateur', 'admin_universite', 'superadmin');
CREATE TYPE "StatutUniversite" AS ENUM ('en_attente', 'actif', 'suspendu');
CREATE TYPE "TypeRessource" AS ENUM ('epreuve', 'texte', 'video', 'audio');
CREATE TYPE "TypeDemande" AS ENUM ('formateur', 'enseignant', 'moderateur', 'admin_universite');
CREATE TYPE "StatutDemande" AS ENUM ('en_attente', 'approuvee', 'refusee');
CREATE TYPE "TypeConversation" AS ENUM ('libre', 'fenetre_reponse');
CREATE TYPE "StatutConversation" AS ENUM ('ouverte', 'fermee');
CREATE TYPE "TypeSignalement" AS ENUM ('personne', 'contenu');
CREATE TYPE "CibleContenu" AS ENUM ('video', 'livre');
CREATE TYPE "StatutSignalement" AS ENUM ('en_attente', 'en_cours', 'resolu');
CREATE TYPE "TypeNotification" AS ENUM ('nouvelle_ressource', 'reponse_recue', 'nouvelle_video_suivie', 'statut_demande', 'nouveau_message_direct');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "rang" "Rang" NOT NULL DEFAULT 'etudiant',
    "emailVerifie" BOOLEAN NOT NULL DEFAULT false,
    "niveauId" TEXT,
    "universiteAdministreeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Universite" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "statut" "StatutUniversite" NOT NULL DEFAULT 'en_attente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Universite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Faculte" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "universiteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Faculte_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Filiere" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "faculteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Filiere_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NiveauEtude" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "filiereId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NiveauEtude_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Matiere" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "niveauId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Matiere_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Canal" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Canal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttributionModerateur" (
    "id" TEXT NOT NULL,
    "moderateurId" TEXT NOT NULL,
    "canalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttributionModerateur_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ressource" (
    "id" TEXT NOT NULL,
    "canalId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "type" "TypeRessource" NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT,
    "fichierCle" TEXT,
    "estSupprime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ressource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "ressourceId" TEXT,
    "conversationId" TEXT,
    "repondAId" TEXT,
    "contenu" TEXT NOT NULL,
    "estSupprime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id"),
    -- Exclusivite ressourceId / conversationId (cf. 4.4)
    CONSTRAINT "Message_ancrage_exclusif" CHECK (
        (("ressourceId" IS NOT NULL)::int + ("conversationId" IS NOT NULL)::int) = 1
    )
);

CREATE TABLE "DemandeStatut" (
    "id" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "type" "TypeDemande" NOT NULL,
    "statut" "StatutDemande" NOT NULL DEFAULT 'en_attente',
    "motif" TEXT,
    "decideurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "DemandeStatut_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompteCreateur" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "bio" TEXT,
    "nombreAbonnes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompteCreateur_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "youtubeId" TEXT NOT NULL,
    "compteCreateurId" TEXT,
    "groupeTdsId" TEXT,
    "niveauCibleId" TEXT,
    "matiereCibleeId" TEXT,
    "nombreLikes" INTEGER NOT NULL DEFAULT 0,
    "estMasquee" BOOLEAN NOT NULL DEFAULT false,
    "masqueParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Video_pkey" PRIMARY KEY ("id"),
    -- Proprietaire exclusif : Compte_Createur OU Groupe_TDS (cf. 4.4)
    CONSTRAINT "Video_proprietaire_exclusif" CHECK (
        (("compteCreateurId" IS NOT NULL)::int + ("groupeTdsId" IS NOT NULL)::int) = 1
    ),
    -- Ciblage niveau / matiere mutuellement exclusif (cf. 4.4)
    CONSTRAINT "Video_ciblage_exclusif" CHECK (
        (("niveauCibleId" IS NOT NULL)::int + ("matiereCibleeId" IS NOT NULL)::int) <= 1
    )
);

CREATE TABLE "Abonnement" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "compteCreateurId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Abonnement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "destinataireId" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "payload" JSONB,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionDevice" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupeTds" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "tuteurId" TEXT NOT NULL,
    "universiteReferenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GroupeTds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AbonnementTds" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "groupeTdsId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AbonnementTds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "utilisateurUnId" TEXT NOT NULL,
    "utilisateurDeuxId" TEXT NOT NULL,
    "type" "TypeConversation" NOT NULL DEFAULT 'libre',
    "statut" "StatutConversation" NOT NULL DEFAULT 'ouverte',
    "dateExpirationFenetre" TIMESTAMP(3),
    "aDejaRepondu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Signalement" (
    "id" TEXT NOT NULL,
    "type" "TypeSignalement" NOT NULL,
    "emetteurId" TEXT NOT NULL,
    "destinataireId" TEXT,
    "canalId" TEXT,
    "cible" "CibleContenu",
    "videoId" TEXT,
    "livreId" TEXT,
    "sujet" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "StatutSignalement" NOT NULL DEFAULT 'en_attente',
    "traiteParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Signalement_pkey" PRIMARY KEY ("id"),
    -- Coherence des variantes personne / contenu (cf. 4.2 #20)
    CONSTRAINT "Signalement_variante_coherente" CHECK (
        ("type" = 'personne' AND "destinataireId" IS NOT NULL AND "cible" IS NULL AND "videoId" IS NULL AND "livreId" IS NULL)
        OR
        ("type" = 'contenu' AND "cible" IS NOT NULL AND (
            ("cible" = 'video' AND "videoId" IS NOT NULL AND "livreId" IS NULL)
            OR
            ("cible" = 'livre' AND "livreId" IS NOT NULL AND "videoId" IS NULL)
        ))
    )
);

CREATE TABLE "Livre" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "auteurLivre" TEXT,
    "description" TEXT,
    "fichierCle" TEXT NOT NULL,
    "ajouteParId" TEXT NOT NULL,
    "niveauCibleId" TEXT,
    "matiereCibleeId" TEXT,
    "estArchive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Livre_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Livre_ciblage_exclusif" CHECK (
        (("niveauCibleId" IS NOT NULL)::int + ("matiereCibleeId" IS NOT NULL)::int) <= 1
    )
);

CREATE TABLE "LikeVideo" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LikeVideo_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Index & contraintes d'unicite
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");
CREATE INDEX "Utilisateur_rang_idx" ON "Utilisateur"("rang");
CREATE INDEX "Utilisateur_niveauId_idx" ON "Utilisateur"("niveauId");
CREATE INDEX "Utilisateur_universiteAdministreeId_idx" ON "Utilisateur"("universiteAdministreeId");

CREATE INDEX "Universite_statut_idx" ON "Universite"("statut");
CREATE INDEX "Faculte_universiteId_idx" ON "Faculte"("universiteId");
CREATE INDEX "Filiere_faculteId_idx" ON "Filiere"("faculteId");
CREATE INDEX "NiveauEtude_filiereId_idx" ON "NiveauEtude"("filiereId");
CREATE INDEX "Matiere_niveauId_idx" ON "Matiere"("niveauId");
CREATE INDEX "Canal_matiereId_idx" ON "Canal"("matiereId");

CREATE UNIQUE INDEX "AttributionModerateur_moderateurId_canalId_key" ON "AttributionModerateur"("moderateurId", "canalId");
CREATE INDEX "AttributionModerateur_canalId_idx" ON "AttributionModerateur"("canalId");

CREATE INDEX "Ressource_canalId_idx" ON "Ressource"("canalId");
CREATE INDEX "Ressource_auteurId_idx" ON "Ressource"("auteurId");

CREATE INDEX "Message_ressourceId_idx" ON "Message"("ressourceId");
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_repondAId_idx" ON "Message"("repondAId");
CREATE INDEX "Message_auteurId_idx" ON "Message"("auteurId");

CREATE INDEX "DemandeStatut_demandeurId_idx" ON "DemandeStatut"("demandeurId");
CREATE INDEX "DemandeStatut_statut_idx" ON "DemandeStatut"("statut");

CREATE UNIQUE INDEX "CompteCreateur_utilisateurId_key" ON "CompteCreateur"("utilisateurId");

CREATE INDEX "Video_compteCreateurId_idx" ON "Video"("compteCreateurId");
CREATE INDEX "Video_groupeTdsId_idx" ON "Video"("groupeTdsId");
CREATE INDEX "Video_niveauCibleId_idx" ON "Video"("niveauCibleId");
CREATE INDEX "Video_matiereCibleeId_idx" ON "Video"("matiereCibleeId");
CREATE INDEX "Video_estMasquee_idx" ON "Video"("estMasquee");

CREATE UNIQUE INDEX "Abonnement_utilisateurId_compteCreateurId_key" ON "Abonnement"("utilisateurId", "compteCreateurId");
CREATE INDEX "Abonnement_compteCreateurId_idx" ON "Abonnement"("compteCreateurId");

CREATE INDEX "Notification_destinataireId_lu_idx" ON "Notification"("destinataireId", "lu");

CREATE INDEX "SessionDevice_utilisateurId_idx" ON "SessionDevice"("utilisateurId");
CREATE INDEX "SessionDevice_refreshTokenHash_idx" ON "SessionDevice"("refreshTokenHash");

CREATE UNIQUE INDEX "GroupeTds_tuteurId_key" ON "GroupeTds"("tuteurId");
CREATE INDEX "GroupeTds_universiteReferenceId_idx" ON "GroupeTds"("universiteReferenceId");

CREATE UNIQUE INDEX "AbonnementTds_utilisateurId_groupeTdsId_key" ON "AbonnementTds"("utilisateurId", "groupeTdsId");
CREATE INDEX "AbonnementTds_groupeTdsId_idx" ON "AbonnementTds"("groupeTdsId");

CREATE UNIQUE INDEX "Conversation_utilisateurUnId_utilisateurDeuxId_key" ON "Conversation"("utilisateurUnId", "utilisateurDeuxId");
CREATE INDEX "Conversation_utilisateurDeuxId_idx" ON "Conversation"("utilisateurDeuxId");
CREATE INDEX "Conversation_statut_idx" ON "Conversation"("statut");

CREATE INDEX "Signalement_destinataireId_statut_idx" ON "Signalement"("destinataireId", "statut");
CREATE INDEX "Signalement_type_idx" ON "Signalement"("type");

CREATE INDEX "Livre_ajouteParId_idx" ON "Livre"("ajouteParId");
CREATE INDEX "Livre_niveauCibleId_idx" ON "Livre"("niveauCibleId");
CREATE INDEX "Livre_matiereCibleeId_idx" ON "Livre"("matiereCibleeId");

CREATE UNIQUE INDEX "LikeVideo_utilisateurId_videoId_key" ON "LikeVideo"("utilisateurId", "videoId");
CREATE INDEX "LikeVideo_videoId_idx" ON "LikeVideo"("videoId");

-- ---------------------------------------------------------------------------
-- Cles etrangeres
-- ---------------------------------------------------------------------------
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_niveauId_fkey" FOREIGN KEY ("niveauId") REFERENCES "NiveauEtude"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_universiteAdministreeId_fkey" FOREIGN KEY ("universiteAdministreeId") REFERENCES "Universite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Faculte" ADD CONSTRAINT "Faculte_universiteId_fkey" FOREIGN KEY ("universiteId") REFERENCES "Universite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Filiere" ADD CONSTRAINT "Filiere_faculteId_fkey" FOREIGN KEY ("faculteId") REFERENCES "Faculte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NiveauEtude" ADD CONSTRAINT "NiveauEtude_filiereId_fkey" FOREIGN KEY ("filiereId") REFERENCES "Filiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Matiere" ADD CONSTRAINT "Matiere_niveauId_fkey" FOREIGN KEY ("niveauId") REFERENCES "NiveauEtude"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Canal" ADD CONSTRAINT "Canal_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttributionModerateur" ADD CONSTRAINT "AttributionModerateur_moderateurId_fkey" FOREIGN KEY ("moderateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionModerateur" ADD CONSTRAINT "AttributionModerateur_canalId_fkey" FOREIGN KEY ("canalId") REFERENCES "Canal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ressource" ADD CONSTRAINT "Ressource_canalId_fkey" FOREIGN KEY ("canalId") REFERENCES "Canal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ressource" ADD CONSTRAINT "Ressource_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "Ressource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_repondAId_fkey" FOREIGN KEY ("repondAId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "DemandeStatut" ADD CONSTRAINT "DemandeStatut_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DemandeStatut" ADD CONSTRAINT "DemandeStatut_decideurId_fkey" FOREIGN KEY ("decideurId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompteCreateur" ADD CONSTRAINT "CompteCreateur_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Video" ADD CONSTRAINT "Video_compteCreateurId_fkey" FOREIGN KEY ("compteCreateurId") REFERENCES "CompteCreateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Video" ADD CONSTRAINT "Video_groupeTdsId_fkey" FOREIGN KEY ("groupeTdsId") REFERENCES "GroupeTds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Video" ADD CONSTRAINT "Video_niveauCibleId_fkey" FOREIGN KEY ("niveauCibleId") REFERENCES "NiveauEtude"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Video" ADD CONSTRAINT "Video_matiereCibleeId_fkey" FOREIGN KEY ("matiereCibleeId") REFERENCES "Matiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Video" ADD CONSTRAINT "Video_masqueParId_fkey" FOREIGN KEY ("masqueParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_compteCreateurId_fkey" FOREIGN KEY ("compteCreateurId") REFERENCES "CompteCreateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionDevice" ADD CONSTRAINT "SessionDevice_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupeTds" ADD CONSTRAINT "GroupeTds_tuteurId_fkey" FOREIGN KEY ("tuteurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupeTds" ADD CONSTRAINT "GroupeTds_universiteReferenceId_fkey" FOREIGN KEY ("universiteReferenceId") REFERENCES "Universite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AbonnementTds" ADD CONSTRAINT "AbonnementTds_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AbonnementTds" ADD CONSTRAINT "AbonnementTds_groupeTdsId_fkey" FOREIGN KEY ("groupeTdsId") REFERENCES "GroupeTds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_utilisateurUnId_fkey" FOREIGN KEY ("utilisateurUnId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_utilisateurDeuxId_fkey" FOREIGN KEY ("utilisateurDeuxId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_emetteurId_fkey" FOREIGN KEY ("emetteurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_canalId_fkey" FOREIGN KEY ("canalId") REFERENCES "Canal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_livreId_fkey" FOREIGN KEY ("livreId") REFERENCES "Livre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_traiteParId_fkey" FOREIGN KEY ("traiteParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Livre" ADD CONSTRAINT "Livre_ajouteParId_fkey" FOREIGN KEY ("ajouteParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Livre" ADD CONSTRAINT "Livre_niveauCibleId_fkey" FOREIGN KEY ("niveauCibleId") REFERENCES "NiveauEtude"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Livre" ADD CONSTRAINT "Livre_matiereCibleeId_fkey" FOREIGN KEY ("matiereCibleeId") REFERENCES "Matiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LikeVideo" ADD CONSTRAINT "LikeVideo_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LikeVideo" ADD CONSTRAINT "LikeVideo_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Triggers : compteurs denormalises (cf. 4.4)
-- SECURITY DEFINER pour contourner la RLS lors de la mise a jour du cache.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "fn_maj_compteur_likes"() RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE "Video" SET "nombreLikes" = "nombreLikes" + 1 WHERE "id" = NEW."videoId";
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE "Video" SET "nombreLikes" = GREATEST("nombreLikes" - 1, 0) WHERE "id" = OLD."videoId";
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER "trg_like_video_compteur"
    AFTER INSERT OR DELETE ON "LikeVideo"
    FOR EACH ROW EXECUTE FUNCTION "fn_maj_compteur_likes"();

CREATE OR REPLACE FUNCTION "fn_maj_compteur_abonnes"() RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE "CompteCreateur" SET "nombreAbonnes" = "nombreAbonnes" + 1 WHERE "id" = NEW."compteCreateurId";
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE "CompteCreateur" SET "nombreAbonnes" = GREATEST("nombreAbonnes" - 1, 0) WHERE "id" = OLD."compteCreateurId";
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER "trg_abonnement_compteur"
    AFTER INSERT OR DELETE ON "Abonnement"
    FOR EACH ROW EXECUTE FUNCTION "fn_maj_compteur_abonnes"();

-- ---------------------------------------------------------------------------
-- Trigger : contrainte moderateur mono-universite (cf. 4.2 #8, 4.4)
-- Un moderateur ne peut etre assigne qu'a des canaux d'une seule universite.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "fn_moderateur_mono_universite"() RETURNS trigger AS $$
DECLARE
    v_univ_nouveau TEXT;
    v_univ_existant TEXT;
BEGIN
    SELECT u."id" INTO v_univ_nouveau
    FROM "Canal" c
    JOIN "Matiere" m ON m."id" = c."matiereId"
    JOIN "NiveauEtude" n ON n."id" = m."niveauId"
    JOIN "Filiere" f ON f."id" = n."filiereId"
    JOIN "Faculte" fa ON fa."id" = f."faculteId"
    JOIN "Universite" u ON u."id" = fa."universiteId"
    WHERE c."id" = NEW."canalId";

    SELECT u."id" INTO v_univ_existant
    FROM "AttributionModerateur" a
    JOIN "Canal" c ON c."id" = a."canalId"
    JOIN "Matiere" m ON m."id" = c."matiereId"
    JOIN "NiveauEtude" n ON n."id" = m."niveauId"
    JOIN "Filiere" f ON f."id" = n."filiereId"
    JOIN "Faculte" fa ON fa."id" = f."faculteId"
    JOIN "Universite" u ON u."id" = fa."universiteId"
    WHERE a."moderateurId" = NEW."moderateurId"
      AND a."id" <> NEW."id"
    LIMIT 1;

    IF v_univ_existant IS NOT NULL AND v_univ_existant <> v_univ_nouveau THEN
        RAISE EXCEPTION 'Un moderateur ne peut gerer que des canaux d''une seule universite (cf. cahier 4.2 #8)';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_moderateur_mono_universite"
    BEFORE INSERT OR UPDATE ON "AttributionModerateur"
    FOR EACH ROW EXECUTE FUNCTION "fn_moderateur_mono_universite"();
