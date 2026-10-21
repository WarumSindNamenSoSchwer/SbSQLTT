# Datenschutzerklärung: Quellen und Prüfprotokoll

Stand: 21.10.2026. Grundlage für `src/lib/tabula/privacy.ts` und `/datenschutz`.
Jede Aussage der Erklärung trägt im Code eine Quellen-ID. Auf der Seite lassen sich die IDs pro Absatz einblenden.

## Veröffentlicht am 21.10.2026

Verantwortlicher: Murat-Can Meric, Lübecker Str. 45, 10559 Berlin (allein). AV-Vertrag Hetzner für Tabula am 21.10.2026 abgeschlossen (Kundennummer K0845673926). Aufsicht: Berliner Beauftragte für Datenschutz und Informationsfreiheit.

## Frühere offene Punkte

1. **Name und ladungsfähige Anschrift** des Verantwortlichen in `CONTROLLER` eintragen (Art. 13 Abs. 1 lit. a DSGVO).
2. ~~**AV-Vertrag mit Hetzner**~~ erledigt am 21.10.2026 (Cloud-Konto). Prüfen, ob das Webhosting-Konto (Mail) dasselbe Konto ist; sonst dort ebenfalls abschließen: https://accounts.hetzner.com/account/dpa (Checkbox, keine Unterschrift nötig, laut Hetzner-FAQ). Danach `CONTROLLER.avv = true`. Vorher behauptet die Seite keinen Vertrag. Achtung: Das Postfach kontakt@tabulasql.de liegt auf dem Webhosting-Paket (konsoleH, 030Activities). Gehört das zu einem anderen Kundenkonto als der Cloud-Server, braucht auch dieses Konto einen AV-Vertrag.
3. **Zuständige Aufsichtsbehörde** hängt vom Sitz des Verantwortlichen ab (§ 40 Abs. 1 BDSG). Text ist für Berlin vorbereitet; bei anderem Bundesland anpassen.

## Technische Prüfung (T)

| ID | Aussage | Prüfung | Ergebnis |
|---|---|---|---|
| T1 | Keine Cookies | Playwright, frisches Profil, alle Seiten (/, /learn, Lektionen, /learn/python/*, /datasets, /login, /impressum, /datenschutz, /teach*, /docs, /fuer-lehrkraefte) | `context.cookies()` = [] |
| T2 | Nur eigener Host | Netzwerkmitschnitt (`page.on('request')`) über alle Seiten | einziger Host `www.tabulasql.de` |
| T3 | SQL im Browser | `src/lib/tabula/sql.ts` | `initSqlJs({ locateFile: () => '/sql/sql-wasm.wasm' })`, kein fetch |
| T5 | Kein Tracking | `grep` im Build nach Fremd-URLs, Netzwerkmitschnitt | keine Analyse-/Werbedienste |
| T6 | Kein Zugriffsprotokoll | `deploy/Caddyfile` ohne `log` in Site-Blöcken (Caddy-Doku: Zugriffslog nur mit `log`); Test: 2 Aufrufe, Zeilenzahl der Logs vorher = nachher (101 = 101) | bestätigt |
| T7 | Gekürzte IPs, 14 Tage | globales `log default` mit `format filter` (`ip_mask 24 48` auf remote_ip/client_ip/X-Forwarded-For, `remote delete`), `roll_at 00:00`, `roll_keep_for 312h`; `caddy validate` = Valid; Test: Protokolldatei enthält nur `127.0.0.1` | bestätigt |
| T8 | Standort Nürnberg | Hetzner-Metadaten `169.254.169.254/hetzner/v1/metadata` | `region: eu-central`, `availability-zone: nbg1-dc3` |
| T9 | AV-Vertrag | Hetzner-Kundenkonto | abgeschlossen, bestätigt vom Verantwortlichen am 21.10.2026 |
| T10 | TLS, Weiterleitung | `openssl s_client` / `curl` | Issuer Let's Encrypt (YE1); `tabulasql.de` → 301 `https://www.tabulasql.de/` |
| T11 | localStorage nur nach Handlung | `grep localStorage` in `src`; Playwright frisches Profil je Seite | Schlüssel `tabula-progress`, `tabula-theme`, `tabula-guest-hint`; nach reinem Aufruf jeder Seite leer (nach Fix in `/teach/settings`) |
| T12 | sessionStorage SvelteKit | `node_modules/@sveltejs/kit/src/runtime/client/constants.js` | `sveltekit:snapshot`, `sveltekit:scroll` |
| T13 | Datenbanken im Code | `src/lib/tabula/course/*.ts` | SQL-Seeds als Konstanten |
| T14 | Downloads lokal | `exportDb` (Blob + Object-URL), CSV-Blob in `/datasets`, `navigator.clipboard.writeText` | kein Netzwerkaufruf |
| T15 | Schriften lokal | `@fontsource/*` in `src`, 139 Schriftdateien unter `build/_app/immutable/assets`, keine `fonts.googleapis`/`gstatic` im Build | bestätigt |
| T16 | Mail bei Hetzner | `dig MX tabulasql.de` | `www750.your-server.de` |
| T17 | Nur Hyperlinks | `grep href="https?://` in `src` | GitHub, PostgreSQL-Doku, EU-ODR (alte Impressum-Seite); keine Einbettungen |
| T18 | Serverhärtung | `sshd -T`, `fail2ban-client get sshd …`, `systemctl is-enabled unattended-upgrades` | passwordauthentication no, permitrootlogin no, maxretry 5, findtime 600, bantime 600, dbpurgeage 86400 s, enabled |
| T19 | Kontaktformular-Dienst: kein Persistenz-Layer, IP nur als Hash im RAM | Quellcode `contact/src/app.ts`, `contact/src/ratelimit.ts` | IP nur via `ContactRateLimiter.hashIp()` (SHA-256) im Speicher; kein Logging von Name/E-Mail/Nachricht; Rate-Limit 3 pro 10 min |

Zusätzlich am 21.10.2026 auf dem Server gesetzt (damit die 14-Tage-Aussage für alle Protokolle stimmt):
- `journald`: `/etc/systemd/journald.conf.d/50-retention.conf` mit `MaxRetentionSec=14day`.
- `rsyslog` (`/var/log/auth.log` u. a.): `/etc/logrotate.d/rsyslog` auf `daily`, `rotate 13`.
- Docker-Konsolenlog des Webservers: Treiber `local`, `max-size 1m`, `max-file 2` (`deploy/compose.yml`).

## Konten, Klassen, Quiz (K)

Die Erklärung beschreibt Konten bereits so, wie sie gebaut werden. Grundlage sind die verbindlichen Vorgaben in `docs/BACKEND-DATENSCHUTZ.md` (K1 bis K12). Das Backend darf nur live gehen, wenn deren Freigabe-Checkliste erfüllt ist.

**K13 – Kontaktformular:** Felder Name (1–100 Z.), E-Mail, optionale Schulangabe (max. 150 Z.), Nachricht (10–5000 Z.). Kein Persistenz-Layer; Daten werden nur als E-Mail weitergeleitet. IP-Rate-Limiting (3 pro 10 min, SHA-256-Hash, nur im RAM). Logging: nur HTTP-Status und Fehlerart, keine personenbezogenen Daten.

## Rechtsquellen (R) und Anbieter (A)

Siehe `SOURCES` in `src/lib/tabula/privacy.ts` (mit Links). Wesentliche Fundstellen:

- Art. 4, 5, 6, 12, 13, 17, 21, 28, 32, 37, 77 DSGVO; Erwägungsgründe 30 und 49 (dsgvo-gesetz.de).
- § 25 TDDDG (gesetze-im-internet.de/ttdsg/__25.html).
- §§ 38, 40 BDSG (gesetze-im-internet.de/bdsg_2018).
- DSK, Orientierungshilfe Digitale Dienste, Version 1.2, Stand November 2024: Rn. 18 (Web-Storage erfasst), Rn. 66 bis 80 (Basisdienst, ausdrücklich gewünschte Funktion, unbedingt erforderlich, Speicherung erst nach Nutzerinteraktion).
- Hetzner: Datenschutz-FAQ (AVV-Abschluss im Kundenkonto, Drittland nur bei gewähltem Standort, Support in der EU), TOMs (Serverzugriff nur durch Auftraggeber), Locations (nbg1).
- Caddy: `log`-Direktive (Zugriffslog nur bei Konfiguration, Filter `ip_mask`, `roll_keep_for`).
- MDN: localStorage/sessionStorage (Lebensdauer, privater Modus).

## Impressum ohne Firma (Recherche, kein Rechtsrat)

- Tabula ist kein privates oder familiäres Angebot. Daher gilt mindestens § 18 Abs. 1 MStV: **Name und Anschrift** (natürliche Person). Wird Tabula geschäftsmäßig betrieben, gilt § 5 DDG zusätzlich (u. a. E-Mail-Adresse).
- Die Anschrift muss **ladungsfähig** sein. Ein Postfach reicht nicht. Zulässig ist auch eine Büro- oder c/o-Anschrift, wenn dort Zustellungen wirksam möglich sind (Leitfaden der NLM; Anbieter wie Impressum-Services mit Zustellvollmacht ab ca. 5 bis 10 € im Monat).
- Eine GbR oder Firma ist nicht nötig; eine Privatperson kann Anbieter sein.
