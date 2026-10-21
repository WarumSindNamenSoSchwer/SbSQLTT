#!/usr/bin/env bash
# Ändert ein SMTP-Passwort auf dem Server und prüft es sofort mit einer Testmail an kontakt@.
#
# Ablauf beim Passwortwechsel:
#   1. Passwort im Hetzner konsoleH ändern:
#      konsoleH > tabulasql.de > E-Mail > Postfächer > formular@ bzw. noreply@ > Passwort ändern
#   2. Dieses Skript lokal ausführen:
#      deploy/set-smtp-password.sh formular     (oder: noreply)
#      Das neue Passwort wird verdeckt abgefragt und nur auf dem Server gespeichert:
#      /opt/tabula/secrets/smtp_formular bzw. /opt/tabula/secrets/smtp_noreply (root, chmod 600)
#   3. Dienste neu starten, damit sie das neue Passwort lesen:
#      ssh tabula 'cd /opt/tabula && sudo docker compose -f compose.backend.yml restart'
#
# Hinweis: Hetzner Cloud sperrt ausgehend Port 465, deshalb Port 587 mit STARTTLS.
set -euo pipefail
box="${1:-}"
case "$box" in formular|noreply) ;; *) echo "Aufruf: $0 formular|noreply" >&2; exit 1 ;; esac

read -rsp "Neues Passwort für ${box}@tabulasql.de: " pw; echo
[ ${#pw} -ge 12 ] || { echo "Zu kurz (mind. 12 Zeichen)." >&2; exit 1; }

printf '%s' "$pw" | ssh tabula "sudo install -d -m 700 /opt/tabula/secrets && sudo sh -c 'umask 077; cat > /opt/tabula/secrets/smtp_${box}'"
unset pw

ssh tabula "sudo sh -c 'printf \"From: Tabula <${box}@tabulasql.de>\r\nTo: kontakt@tabulasql.de\r\nSubject: SMTP-Test ${box}@ nach Passwortwechsel\r\n\r\nPasswort funktioniert.\r\n\" | curl -sS --max-time 25 --ssl-reqd --url smtp://mail.your-server.de:587 --user ${box}@tabulasql.de:\"\$(cat /opt/tabula/secrets/smtp_${box})\" --mail-from ${box}@tabulasql.de --mail-rcpt kontakt@tabulasql.de -T -'" \
  && echo "OK: gespeichert und Testmail an kontakt@ gesendet." \
  || { echo "FEHLER: Login fehlgeschlagen. Passwort im konsoleH prüfen und Skript erneut ausführen." >&2; exit 1; }
