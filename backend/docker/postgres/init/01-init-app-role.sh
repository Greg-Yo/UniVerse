#!/bin/bash
# ============================================================================
# Cree le role applicatif NON superuser utilise par l'API a l'execution.
# La RLS s'applique a ce role (contrairement au role owner qui la contourne).
# Ce script s'execute UNE SEULE FOIS, au premier demarrage du volume Postgres.
# ============================================================================
set -e

APP_PASSWORD="${APP_DB_PASSWORD:-change_me_app_password}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'universe_app') THEN
            CREATE ROLE universe_app LOGIN PASSWORD '${APP_PASSWORD}';
        END IF;
    END
    \$\$;

    -- Autorise la connexion et l'usage du schema ; les droits objets fins
    -- (SELECT/INSERT/UPDATE/DELETE) et la RLS sont poses par la migration RLS.
    GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO universe_app;
    GRANT USAGE ON SCHEMA public TO universe_app;
EOSQL

echo "Role applicatif 'universe_app' pret."
