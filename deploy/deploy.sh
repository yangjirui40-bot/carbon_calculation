#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
ENV_FILE="${CARBON_ENV_FILE:-.env.production}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing private production environment: $ENV_FILE" >&2
  exit 1
fi
export CARBON_RUNTIME_ENV_FILE="$ENV_FILE"
docker network inspect adc-clinic_default >/dev/null
docker image inspect carbonspeed-backend:20261118-final >/dev/null
docker compose --env-file "$ENV_FILE" -f deploy.compose.cohost.yml config --quiet
docker compose --env-file "$ENV_FILE" -f deploy.compose.cohost.yml up -d
printf '%s\n' 'Carbon services started. Verify readiness and add the reviewed Caddy site using the deployment guide.'
