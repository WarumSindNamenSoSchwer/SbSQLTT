# Tabula API - Backend

Node.js/TypeScript/Fastify Backend fuer den Tabula SQL-Trainer.

## Technologie-Stack

| Komponente | Paket | Begruendung |
|---|---|---|
| HTTP-Framework | `fastify` v5 | schnell, TypeScript-nativ, kein Overhead |
| Datenbank | `better-sqlite3` | synchron, WAL-Modus, ideal fuer Einzel-Container |
| Passwort-Hashing | `argon2` (node-argon2) | OWASP-empfohlen, unterstuetzt `associatedData` |
| Validierung | `zod` | typsichere Eingabevalidierung |
| Cookie | `@fastify/cookie` | HttpOnly, Secure, SameSite=Lax |
| Tests | `vitest` | schnell, ESM-nativ |

## Start lokal

```bash
cd server
npm install
npm run dev          # Entwicklungsmodus (tsx watch, :memory: DB empfohlen)
DB_PATH=./test.db npm run dev   # persistente lokale DB
```

### Voraussetzungen

- Node.js >= 22
- Build-Tools fuer native Addons (argon2, better-sqlite3):
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Linux: `build-essential python3`

## Tests

```bash
npm test            # alle Tests einmalig ausfuehren
npm run test:watch  # interaktiv
```

Tests decken die Freigabe-Checkliste aus `docs/BACKEND-DATENSCHUTZ.md` ab:
- **K1/K2**: Pflichtfelder Schueler und Lehrkraft
- **K3**: Argon2id-Parameter, Hash-Bindung an Konto, Umbenennung nur mit Passwort
- **K4**: Klassen-Sichtbarkeit
- **K6**: Cookie-Attribute (HttpOnly, Secure, SameSite=Lax, Max-Age)
- **K8**: Konto loeschen entfernt alle Zeilen, Inaktivitaets-Jobs
- **K10**: Keine IP-Adressen in DB-Tabellen

## Umgebungsvariablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `DB_PATH` | `/data/tabula.db` | SQLite-Datenbankpfad |
| `PORT` | `3000` | HTTP-Port |
| `HOST` | `0.0.0.0` | Bind-Adresse |
| `ALLOWED_ORIGIN` | `https://www.tabulasql.de` | Erlaubter Origin fuer CSRF-Check |
| `SITE_URL` | `https://www.tabulasql.de` | Basis-URL fuer E-Mail-Links |
| `LOG_LEVEL` | `info` | Pino-Log-Level |

## API-Endpunkte

Alle unter `/api/`:

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/health` | Gesundheitspruefung |
| POST | `/register` | Konto erstellen (student/teacher) |
| POST | `/login` | Anmelden (Benutzername oder E-Mail); gibt `must_change_password` bei Lehrkraft-Reset |
| POST | `/logout` | Abmelden |
| GET | `/me` | Eigenes Konto abrufen |
| PATCH | `/me` | Anzeigename / Benutzername aendern |
| DELETE | `/me` | Konto sofort loeschen (K8) |
| POST | `/password/forgot` | Passwort-Reset anfordern |
| POST | `/password/reset` | Passwort zuruecksetzen |
| GET | `/progress` | Lernfortschritt laden |
| PUT | `/progress` | Lernfortschritt speichern (inkl. last_attempt) |
| POST | `/classes/join` | Klasse per Code beitreten |
| GET | `/classes/mine` | Eigene Klassen (Schueler): Fokus-Lektion, freigeschaltete Lektionen |

### Lehrkraft-API (`/api/teacher`, nur role=teacher)

Zugriffskontrolle: Nur `role=teacher`. Fremde Klassen liefern 404 (nicht 403), um Existenz nicht zu verraten (K4).

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/teacher/classes` | Alle eigenen Klassen (inkl. Schueleranzahl, haengt-fest-Zaehler) |
| POST | `/teacher/classes` | Neue Klasse erstellen (Join-Code wird automatisch erzeugt) |
| GET | `/teacher/classes/:id` | Eine Klasse abrufen |
| PATCH | `/teacher/classes/:id` | Name oder `archived`-Flag aendern |
| DELETE | `/teacher/classes/:id` | Klasse loeschen (K8: alle Mitgliedschaften, Fortschritt, Einstellungen) |
| POST | `/teacher/classes/:id/code` | Neuen Join-Code erzeugen |
| GET | `/teacher/classes/:id/dashboard` | Dashboard: je Schueler Status fuer Fokus-Lektion (fertig/dran/haengt_fest) |
| GET | `/teacher/classes/:id/matrix` | Fortschritts-Matrix Schueler x Lektionen |
| GET | `/teacher/classes/:id/students` | Schuelerliste der Klasse |
| PATCH | `/teacher/classes/:id/students/:uid` | Anzeigename eines Schuelers aendern |
| DELETE | `/teacher/classes/:id/students/:uid` | Schueler entfernen (K8: Mitgliedschaft + Fortschritt weg) |
| GET | `/teacher/classes/:id/students/:uid/last-attempt` | Letzte Abfrage + Fehler eines Schuelers (K4) |
| PUT | `/teacher/classes/:id/lessons` | Lektionseinstellungen setzen (freischalten, Reihenfolge, Fokus) |
| POST | `/teacher/classes/:id/students/:uid/password-reset` | Einmal-Passwort fuer Schueler setzen; erzwingt Passwortaenderung beim naechsten Login (K3) |

## Deploy-Schritte (noch nicht ausfuehren - nur zur Dokumentation)

1. **Image bauen:**
   ```bash
   docker build -t tabula-api:latest server/
   ```

2. **Compose starten:**
   ```bash
   docker compose -f deploy/compose.yml -f deploy/compose.backend.yml up -d
   ```

3. **Caddy konfigurieren:**
   Den `handle /api/*`-Block aus `deploy/Caddyfile.api` in `deploy/Caddyfile`
   unter `www.tabulasql.de { ... }` einfuegen.

4. **Backup-Key erzeugen (age empfohlen):**
   ```bash
   age-keygen -o /run/secrets/backup_key
   chmod 600 /run/secrets/backup_key
   ```

5. **Backup-Cron einrichten:**
   ```bash
   # Im Container oder auf dem Host:
   0 2 * * * docker exec <api-container> /app/scripts/backup.sh
   ```

## Sicherheitshinweise

- **Passwort-Hashing (K3):** Argon2id, 19 MiB RAM, 2 Iterationen. Der Hash ist
  an Benutzername und Erstellungstag gebunden (Associated Data).
- **CSRF (K6):** Origin-Header-Pruefung fuer alle schreibenden Anfragen.
  Standard: `https://www.tabulasql.de` (konfigurierbar via `ALLOWED_ORIGIN`).
- **Rate-Limiting (K10):** Nur im Arbeitsspeicher. Keine IP-Adressen gespeichert.
- **Sessions (K6):** SHA-256 des Tokens gespeichert, nicht das Token selbst.
- **Logs:** Pino mit `redact` - Passwortfelder und Cookies werden zensiert.

## Fortschritts-Vertrag (progress contract)

### PUT /api/progress - Schritt-Vertrag (ab P7)

Das Frontend schickt **je Uebungsschritt eine Zeile** (nicht eine pro Lektion):

```json
{
  "progress": [
    {
      "lesson_id": "where-filters",
      "step": 2,
      "done": true,
      "attempts": 4,
      "updated_at": 1700000000
    }
  ],
  "last_attempts": [
    {
      "lesson_id": "where-filters",
      "step": 2,
      "query": "SELECT title FROM books WHERE year > 2020;",
      "error_msg": ""
    }
  ]
}
```

Felder:
- `step`: 0-basierter Index des Schritts in `lesson.steps` (nur `kind === 'exercise'`)
- `done`: `true` wenn die Uebung geloest wurde (auch nach Loesung-anzeigen)
- `attempts`: Gesamtzahl der Ausfuehrungen dieser Uebung in der Session
- `last_attempts.error_msg`: leer wenn kein Fehler; `"Ergebnis stimmt nicht"` bei falscher Ausgabe; SQL-Fehlermeldung bei Syntaxfehler

**Haengt-fest-Erkennung im Dashboard:**
- `done = 0` UND `attempts >= 3` → haengt fest
- ODER: `last_attempt.error_msg != ''` UND `updated_at < now - 300s` → haengt fest

**Fertig-Erkennung:**
- Die Anzahl erledigter Schritte (`done = 1`) muss >= `exercise_steps` aus `server/src/lesson-steps.json` sein.
- `lesson-steps.json` wird von `tools/gen-lesson-steps.mjs` generiert und muss bei Kursaenderungen neu erstellt werden.

### GET /api/progress - Antwortformat

```json
{
  "progress": [
    { "lesson_id": "where-filters", "step": 2, "done": true, "attempts": 4, "updated_at": 1700000000 }
  ],
  "last_attempts": [
    { "lesson_id": "where-filters", "step": 2, "query": "...", "error_msg": "", "updated_at": 1700000000 }
  ]
}
```

### Abmelde-Verhalten (K4)

Beim Abmelden wird `localStorage['tabula-progress']` geleert. Damit sieht der naechste Schueler am selben Schulrechner nicht den Stand des vorherigen.



- [ ] SMTP-Implementierung (Hetzner, `noreply@tabulasql.de`, Passwort aus `/run/secrets/smtp_noreply`)
- [ ] WebSocket-Support fuer Live-Quiz (K5, Spec 7.5)
- [x] Lehrkraft-API (Klassen verwalten, Schuelerfortschritt einsehen) ← P6 erledigt
- [ ] E-Mail-Verifikation fuer Lehrkraefte (K7)
- [ ] Quiz-Tabellen implementieren (Migration 0006 ist Platzhalter)
- [ ] `ACCOUNTS_LIVE = true` in `src/lib/tabula/privacy.ts` nach Freigabe
