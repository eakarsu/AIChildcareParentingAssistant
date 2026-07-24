#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$ROOT/.env" ] || { echo 'Missing .env; copy .env.example and configure it.' >&2; exit 1; }
[ -d "$ROOT/backend/node_modules" ] && [ -d "$ROOT/frontend/node_modules" ] || { echo 'Dependencies absent; run scripts/bootstrap.sh.' >&2; exit 1; }
set -a
. "$ROOT/.env"
set +a

backend_port="${BACKEND_PORT:-4000}"
frontend_port="${FRONTEND_PORT:-3000}"
for port in "$backend_port" "$frontend_port"; do
  if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use; refusing to stop another process." >&2
    exit 1
  fi
done

if [ "${MIGRATE_ON_START:-false}" = true ]; then
  case "${ALLOW_SCHEMA_MIGRATION:-}" in
    1|true) ;;
    *) echo 'Explicit schema migration acknowledgement is required.' >&2; exit 1 ;;
  esac
  bash "$ROOT/scripts/migrate.sh"
  node "$ROOT/backend/scripts/create-admin.js"
fi

(cd "$ROOT/backend" && npm start) & BACKEND_PID=$!
(cd "$ROOT/frontend" && ./node_modules/.bin/vite --host "${HOST:-127.0.0.1}" --port "$frontend_port") & FRONTEND_PID=$!
cleanup(){ kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true; wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$BACKEND_PID" "$FRONTEND_PID"
