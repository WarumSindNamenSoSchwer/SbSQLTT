#!/usr/bin/env bash
# server/scripts/backup.sh
# Datenbank-Backup mit Verschluesselung und 7-Tage-Rotation (K8)
#
# Verwendung:
#   ./backup.sh
#
# Umgebungsvariablen:
#   DB_PATH          Pfad zur SQLite-Datenbank (Standard: /data/tabula.db)
#   BACKUP_DIR       Zielordner fuer Backups (Standard: /data/backups)
#   AGE_KEY_PATH     Pfad zur age-Schluessel-Datei (Standard: /run/secrets/backup_key)
#   RETENTION_DAYS   Aufbewahrungsdauer in Tagen (Standard: 7)
#
# Verschluesselung:
#   Primaer: age (https://age-encryption.org) - empfohlen
#   Fallback: openssl AES-256-CBC wenn age nicht vorhanden
#
# Einrichten:
#   age-keygen -o /run/secrets/backup_key
#   chmod 600 /run/secrets/backup_key
#   Oeffentlichen Schluessel aus der Datei in ./backup.pub kopieren

set -euo pipefail

DB_PATH="${DB_PATH:-/data/tabula.db}"
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
AGE_KEY_PATH="${AGE_KEY_PATH:-/run/secrets/backup_key}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

DATE=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_FILE="${BACKUP_DIR}/tabula-${DATE}.db"

# Backup-Ordner anlegen
mkdir -p "${BACKUP_DIR}"

if [ ! -f "${DB_PATH}" ]; then
    echo "FEHLER: Datenbank nicht gefunden: ${DB_PATH}" >&2
    exit 1
fi

# SQLite-Backup (konsistentes Snapshot via .backup-Kommando)
echo "Erstelle Backup: ${DB_PATH} -> ${BACKUP_FILE}"
sqlite3 "${DB_PATH}" ".backup '${BACKUP_FILE}'"

# Verschluesselung
if command -v age >/dev/null 2>&1 && [ -f "${AGE_KEY_PATH}" ]; then
    # age-Verschluesselung (empfohlen)
    PUBKEY=$(grep 'public key:' "${AGE_KEY_PATH}" | awk '{print $NF}')
    if [ -z "${PUBKEY}" ]; then
        echo "WARNUNG: Kein oeffentlicher Schluessel in ${AGE_KEY_PATH} gefunden. Fallback auf openssl." >&2
    else
        age -r "${PUBKEY}" -o "${BACKUP_FILE}.age" "${BACKUP_FILE}"
        rm "${BACKUP_FILE}"
        BACKUP_FILE="${BACKUP_FILE}.age"
        echo "Backup verschluesselt (age): ${BACKUP_FILE}"
    fi
elif command -v openssl >/dev/null 2>&1 && [ -f "${AGE_KEY_PATH}" ]; then
    # Fallback: openssl AES-256-CBC
    # Schluessel-Material aus Datei lesen (erste 64 Zeichen als Hex-Passphrase)
    PASSPHRASE=$(head -c 64 "${AGE_KEY_PATH}" | base64 -w0 2>/dev/null || base64 "${AGE_KEY_PATH}" | head -c 64)
    openssl enc -aes-256-cbc -salt -pbkdf2 \
        -in "${BACKUP_FILE}" \
        -out "${BACKUP_FILE}.enc" \
        -pass "pass:${PASSPHRASE}"
    rm "${BACKUP_FILE}"
    BACKUP_FILE="${BACKUP_FILE}.enc"
    echo "Backup verschluesselt (openssl): ${BACKUP_FILE}"
else
    echo "WARNUNG: Weder age noch openssl gefunden oder Schluessel fehlt. Backup UNVERSCHLUESSELT: ${BACKUP_FILE}" >&2
fi

# 7-Tage-Rotation: aeltere Backups loeschen (K8: max. 7 Tage)
find "${BACKUP_DIR}" -name 'tabula-*.db*' -mtime +"${RETENTION_DAYS}" -delete
echo "Rotation: Backups aelter als ${RETENTION_DAYS} Tage geloescht."

# Aktuellen Status
echo "Backup abgeschlossen: ${BACKUP_FILE}"
ls -lh "${BACKUP_DIR}/tabula-"* 2>/dev/null || true
