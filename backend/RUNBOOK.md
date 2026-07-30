# RUNBOOK - Exploitation UniVerse Backend

Guide operationnel pour une equipe debutante en auto-hebergement. Objectif :
tenir un backend fiable sur **un seul VPS** en absorbant l'ops que Supabase
gerait auparavant (sauvegardes, TLS, mises a jour de securite).

---

## 1. Calendrier V1 revise (ajout Sprint 0)

Le cahier des charges estime lui-meme qu'un backend maison represente
"plusieurs semaines" de travail avant la logique metier (5.3). On ajoute donc
un **Sprint 0 infrastructure** avant le decoupage hebdomadaire original (6.2).

| Phase | Duree | Contenu |
| --- | --- | --- |
| **Sprint 0** (nouveau) | ~2-3 semaines | Docker Compose (Postgres/MinIO/Redis/API/Caddy), schema Prisma des 22 entites + migrations, auth JWT + Session/Device, squelette RLS + Guards, CI/CD de base, Socket.io minimal, endpoint `/health`. |
| Semaine 1 | 1 sem | Structure academique (hierarchie), inscription, seed universite pilote. |
| Semaine 2 | 1 sem | Roles, demandes de statut, RLS + Guards complets, assignation moderateurs. |
| Semaine 3 | 1 sem | Ressources + fils de discussion, notifications (temps reel). |
| Semaine 4 | 1 sem | Video (Compte_Createur, YouTube API, feed, likes), Groupes TDS. |
| Semaine 5 | 1 sem | Messagerie directe (matrice 3.8), signalements, fenetre 24h. |
| Semaine 6 | 1 sem | Bibliotheque, recherche, recette, durcissement securite (8.2). |

**Plan de repli (cf. 6.1)** : en cas de retard semaine 5, limiter la messagerie
a l'Enseignant seul. La marge est plus faible qu'avec Supabase : prioriser.

---

## 2. Premier deploiement (VPS)

```bash
# 1. Installer Docker + Docker Compose sur le VPS (Ubuntu 22.04+).
# 2. Cloner le repo dans /opt/universe.
git clone <repo> /opt/universe && cd /opt/universe

# 3. Configurer l'environnement.
cp .env.example .env
#   - mots de passe forts (POSTGRES_PASSWORD, APP_DB_PASSWORD, MINIO_*, JWT_*)
#   - APP_DB_PASSWORD == mot de passe dans DATABASE_URL (role universe_app)
#   - domaines reels dans le Caddyfile

# 4. Demarrer la stack (les migrations Prisma s'appliquent au boot de l'api).
docker compose up -d --build

# 5. Amorcer le Superadmin + universite pilote.
#    Le seed utilise ts-node (devDependency), absent de l'image de prod slim.
#    Le lancer depuis un poste de dev en pointant DIRECT_URL vers le serveur :
#      DIRECT_URL="postgresql://universe:...@VPS:5432/universe" npm run db:seed
#    (ou temporairement via une image incluant les devDependencies).
```

Verifier : `curl https://api.votre-domaine/health` doit renvoyer `status: ok`.

---

## 3. Modele de securite (rappel)

- L'API se connecte en base avec le role **non-superuser `universe_app`** =>
  la **RLS PostgreSQL** s'applique (2e couche de defense).
- Les **Guards NestJS** (`RankGuard`, `MessagingPolicy`) sont la 1re couche.
- Les migrations tournent avec le role **owner** (`DIRECT_URL`).
- Chaque requete protegee positionne `app.current_user_id` / `app.current_rang`
  via `PrismaService.withRlsContext` (SET LOCAL, portee transaction).
- **Point de vigilance 8.2** : chaque politique de la matrice 3.8 doit etre
  testee individuellement (voir `messaging-policy.spec.ts`).

---

## 4. Sauvegardes (Postgres + MinIO)

### Postgres - dump chiffre quotidien vers stockage off-site (B2/R2)
```bash
# Cron (03h00) - exemple ; adapter les identifiants B2/R2 (aws-cli configure).
0 3 * * * docker exec universe-postgres pg_dump -U universe universe \
  | gzip > /opt/universe/backups/universe-$(date +\%F).sql.gz \
  && aws s3 cp /opt/universe/backups/universe-$(date +\%F).sql.gz \
     s3://universe-backups/ --endpoint-url https://<r2-endpoint>
```

### Restauration
```bash
gunzip -c universe-2026-07-24.sql.gz | docker exec -i universe-postgres \
  psql -U universe -d universe
```

### MinIO
```bash
# Replication ou copie miroir vers un bucket off-site.
docker exec universe-minio mc mirror local/resources r2/universe-resources
```

**Tester la restauration** au moins une fois par trimestre (backup non teste = pas de backup).

---

## 5. TLS / certificats

- Gere **automatiquement par Caddy** (Let's Encrypt) : rien a faire tant que
  les enregistrements DNS pointent vers le VPS et que les ports 80/443 sont ouverts.
- Renouvellement automatique. Verifier les logs Caddy en cas d'alerte :
  `docker compose logs caddy`.

---

## 6. Mises a jour & maintenance

| Frequence | Action |
| --- | --- |
| Continu | Deploiement auto via GitHub Actions (push sur `main`). |
| Hebdo | `docker compose pull && docker compose up -d` (images de base a jour). |
| Hebdo | Patchs securite OS : `apt update && apt upgrade`. |
| Mensuel | `npm audit` + montee de version des dependances (branche dediee). |
| Trimestriel | Test de restauration backup. Revue des acces (cles SSH, secrets). |

---

## 7. Observabilite

- **Sentry** : erreurs API (>= 500) + erreurs Flutter (`SENTRY_DSN`).
- **/health** : surveille par UptimeRobot (palier gratuit) -> alerte email/Telegram.
- **Logs conteneurs** : Dozzle (leger) ou `docker compose logs -f <service>`.
- **BullMQ** : jobs visibles via Redis ; surveiller la file `youtube-upload`
  (retries en cas de quota YouTube atteint, cf. risque 8.2).

---

## 8. Incidents frequents

| Symptome | Piste |
| --- | --- |
| `/health` = `degraded` (db ko) | Conteneur postgres down / volume plein : `docker compose ps`, `df -h`. |
| Requetes RLS renvoient 0 ligne | GUC non positionne : verifier que le service passe par `withRlsContext`. |
| Uploads YouTube bloques | Quota API v3 atteint : la file BullMQ retente (backoff exponentiel). |
| Socket.io ne diffuse pas | Verifier Redis (`docker compose logs redis`) + adaptateur. |
| Migration echoue au boot | Verifier `DIRECT_URL` (role owner) et l'existence du role `universe_app`. |
