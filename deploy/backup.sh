#!/usr/bin/env bash
# deploy/backup.sh
# Tägliche Sicherung der Tabula-Datenbank (K8). Läuft auf dem Server als root per systemd-Timer
# (deploy/tabula-backup.service + .timer).
#
# - Konsistenter Schnappschuss über die SQLite-Online-Backup-API im laufenden API-Container
#   (better-sqlite3 db.backup), keine Unterbrechung des Dienstes.
# - Verschlüsselung mit age an einen ÖFFENTLICHEN Schlüssel (/opt/tabula/secrets/backup_recipients,
#   z. B. der SSH-Schlüssel ~/.ssh/tabula.pub des Betreibers). Der Server kann Sicherungen
#   schreiben, aber nicht lesen: Entschlüsseln geht nur mit dem privaten Schlüssel auf dem Laptop.
# - Aufbewahrung höchstens 7 Tage, ältere Dateien werden gelöscht.
# - Klartext liegt nur kurz im RAM-Dateisystem (/dev/shm) und wird sofort gelöscht.
#
# Wiederherstellen (auf dem Laptop):
#   scp tabula:/opt/tabula/backups/tabula-JJJJ-MM-TT.db.age .
#   age -d -i ~/.ssh/tabula -o tabula.db tabula-JJJJ-MM-TT.db.age
set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-/opt/tabula/backups}
RECIPIENTS=${RECIPIENTS:-/opt/tabula/secrets/backup_recipients}
CONTAINER=${CONTAINER:-tabula-api-1}
KEEP_DAYS=7

[ -s "$RECIPIENTS" ] || { echo "Fehlt: $RECIPIENTS (öffentlicher Schlüssel)" >&2; exit 1; }
command -v age >/dev/null || { echo "age ist nicht installiert (apt install age)" >&2; exit 1; }
docker inspect "$CONTAINER" >/dev/null 2>&1 || { echo "Container $CONTAINER läuft nicht, nichts zu sichern." >&2; exit 0; }

install -d -m 700 "$BACKUP_DIR"
stamp=$(date -u +%Y-%m-%d)
tmp=$(mktemp -p /dev/shm tabula-backup.XXXXXX)
trap 'rm -f "$tmp"' EXIT

# Schnappschuss im Container nach /tmp (tmpfs), dann herauskopieren und dort löschen
docker exec "$CONTAINER" node -e "
  const D = require('better-sqlite3');
  const db = new D(process.env.DB_PATH || '/data/tabula.db', { readonly: true });
  db.backup('/tmp/snapshot.db').then(() => { db.close(); }).catch((e) => { console.error(e.message); process.exit(1); });
"
docker cp "$CONTAINER:/tmp/snapshot.db" "$tmp" >/dev/null
docker exec "$CONTAINER" rm -f /tmp/snapshot.db

age -R "$RECIPIENTS" -o "$BACKUP_DIR/tabula-$stamp.db.age" "$tmp"
chmod 600 "$BACKUP_DIR/tabula-$stamp.db.age"

# Aufbewahrung: höchstens 7 Tage
find "$BACKUP_DIR" -name 'tabula-*.db.age' -type f -mtime +$((KEEP_DAYS - 1)) -delete

echo "Sicherung erstellt: tabula-$stamp.db.age ($(stat -c %s "$BACKUP_DIR/tabula-$stamp.db.age") Byte)"
