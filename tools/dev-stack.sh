#!/usr/bin/env bash
# Lokaler Stack für Entwicklung und Abnahme: API (Port 3005, eigene Wegwerf-DB) + Vite (Port 5194).
# Startet beides im Hintergrund. Konten legt man über die Oberfläche an (Lehrkraft registrieren,
# Klasse anlegen, mit dem Klassencode beitreten), Mails gehen ins Leere (NOOP-Sender).
#   tools/dev-stack.sh start   # startet, wartet bis bereit
#   tools/dev-stack.sh stop
set -euo pipefail
cd "$(dirname "$0")/.."
RUN="${TMPDIR:-/tmp}/tabula-dev"
mkdir -p "$RUN"
case "${1:-start}" in
  stop)
    for f in "$RUN"/*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
    echo "gestoppt"; exit 0 ;;
  start)
    if ! curl -s -o /dev/null http://localhost:3005/api/me; then
      rm -f "$RUN/dev.db"
      (cd server && DB_PATH="$RUN/dev.db" PORT=3005 HOST=127.0.0.1 ALLOWED_ORIGIN=http://localhost:5194 \
        SITE_URL=http://localhost:5194 SECURE_COOKIE=false nohup npx tsx src/index.ts </dev/null >"$RUN/api.log" 2>&1 & echo $! >"$RUN/api.pid")
    fi
    if ! curl -s -o /dev/null http://localhost:5194/; then
      (VITE_ACCOUNTS_LIVE=1 nohup npx vite dev --port 5194 --strictPort </dev/null >"$RUN/vite.log" 2>&1 & echo $! >"$RUN/vite.pid")
    fi
    for i in $(seq 1 60); do
      curl -s -m 2 -o /dev/null http://localhost:3005/api/me && curl -s -m 5 -o /dev/null http://localhost:5194/ && break
      sleep 1
    done
    echo "API: http://localhost:3005 · Seite: http://localhost:5194 · Logs: $RUN"
    ;;
esac
