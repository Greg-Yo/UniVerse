# UniVerse Backend (maison, sans BaaS)

Backend auto-heberge pour la plateforme UniVerse, remplacant Supabase par une stack
maitrisee de bout en bout, deployable sur un seul VPS via Docker Compose.

Voir le cahier des charges (`cahier_des_charges_universe.docx`) pour le contexte produit,
le modele de donnees (section 4) et les regles metier (sections 3.8, 4.4).

## Stack

| Brique | Technologie | Remplace (Supabase) |
| --- | --- | --- |
| API REST + WebSocket | NestJS (TypeScript) | PostgREST + Edge Functions |
| Base de donnees | PostgreSQL 16 (Docker) + RLS native | Postgres managé + RLS |
| ORM / migrations | Prisma | Migrations Supabase |
| Authentification | JWT (access/refresh) + Passport + Argon2 | Supabase Auth |
| Temps reel | Socket.io (adaptateur Redis) | Supabase Realtime |
| Stockage fichiers | MinIO (S3-compatible) + URLs pre-signees | Supabase Storage |
| Jobs asynchrones | BullMQ (Redis) | Edge Functions / cron |
| Reverse proxy + TLS | Caddy (Let's Encrypt) | (inclus dans Supabase) |
| Video | YouTube Data API v3 | inchangé |
| Monitoring | Sentry + `/health` | Sentry + logs Supabase |

## Architecture

```
Flutter --> Caddy (TLS) --> NestJS API --> PostgreSQL (RLS)
                                       --> MinIO (URLs pre-signees)
                                       --> Redis --> Worker BullMQ
                                       --> YouTube Data API v3
```

## Modele de securite (defense en profondeur)

Deux couches, conformement aux points de vigilance 4.4 / 8.2 du cahier :

1. **RLS PostgreSQL native** : l'API se connecte avec un role NON superuser
   (`universe_app`) ; chaque requete positionne `app.current_user_id` et
   `app.current_rang` via `SET LOCAL`, et les policies SQL filtrent lecture/ecriture.
2. **Guards NestJS** : `RankGuard` (capacites de contenu, `rang >= X`) et la
   `MessagingPolicy` (matrice 3.8, testee sur le **rang exact**, jamais deduite du rang).

## Demarrage local

### Prerequis
- Node.js 22+, Docker + Docker Compose

### Installation
```bash
cp .env.example .env      # renseigner les secrets
npm install
```

### Option A - tout en Docker
```bash
docker compose up -d --build
# Les migrations Prisma sont appliquees automatiquement au demarrage de l'API.
```

### Option B - API en local, infra en Docker
```bash
docker compose up -d postgres redis minio
npm run prisma:migrate:dev
npm run db:seed          # cree le Superadmin + universite pilote (SA-1)
npm run start:dev
```

L'API est disponible sur `http://localhost:3000`, la doc Swagger sur `http://localhost:3000/docs`.

## Perimetre V1 (cf. plan)

Voir [`RUNBOOK.md`](./RUNBOOK.md) pour l'exploitation (backups, TLS, mises a jour)
et le decoupage calendaire revise (ajout d'un Sprint 0 infrastructure).
