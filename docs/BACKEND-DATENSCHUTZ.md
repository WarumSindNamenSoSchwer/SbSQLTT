# Backend: Datenschutz-Vorgaben (verbindlich)

Stand: 25.10.2026. Diese Datei legt fest, **welche Daten das Backend (Lehrkraft-Konten, Klassen-Login der Schüler, Live-Quiz) verarbeiten darf und wie lange**.
Die Datenschutzerklärung (`src/lib/tabula/privacy.ts`, Quellen-IDs K1 bis K12) beschreibt genau diese Vorgaben.
Weicht die Umsetzung ab, muss zuerst diese Datei und dann die Erklärung geändert werden. Jede Vorgabe hat unten einen Prüfpunkt.

## K1 Schüler (Klassen-Login, keine Schülerkonten)
Umsetzungsplan: `docs/KLASSEN-LOGIN.md`.
- Es gibt keine Schülerkonten, keine Registrierung ohne Klasse, keinen Benutzernamen, keine E-Mail-Adresse.
- Beitritt per QR-Code oder Klassencode, Anmeldung an jedem Gerät mit Klassencode, Name und eigenem Passwort (mindestens 8 Zeichen).
- Der Browser leitet aus Passwort, Klassen-Salz und Name einen Schlüssel ab (Argon2id). Name und Passwort verlassen das Gerät nie.
- Der Server speichert je Schüler nur: zufällige Nummer, Klasse, SHA-256 des abgeleiteten Schlüssels, verschlüsselten Namen (nur für die Lehrkraft lesbar), Zeitpunkt von Beitritt und letzter Anmeldung.
- Kein Klarname, kein Passwort, keine E-Mail, kein Alter, keine IP beim Server.
- Passwort vergessen: Die Lehrkraft erzeugt einen Einmal-Code (15 Minuten gültig, nur als Hash gespeichert), damit legt der Schüler selbst ein neues Passwort fest.

## K2 Lehrkraftkonto
- Pflicht: Name, E-Mail-Adresse, Passwort, Bestätigung, dass die Datenschutzhinweise gelesen wurden.
- Optional: Schule.
- Schlüsselpaar der Lehrkraft (RSA-OAEP 3072), erzeugt in ihrem Browser bei der Registrierung. Der öffentliche Teil liegt offen beim Server. Der private Teil liegt nur verschlüsselt beim Server: einmal mit dem Passwort der Lehrkraft, einmal mit ihrem Wiederherstellungscode (beides über Argon2id und AES-GCM im Browser). Der Server kann ihn nicht lesen.
- Wiederherstellungscode: einmal bei der Registrierung angezeigt, zum Ausdrucken. Wird nie an den Server geschickt.

## K3 Passwörter
Gilt für Lehrkräfte. Schüler siehe K1 (Ableitung im Browser, Server speichert nur SHA-256 des abgeleiteten Schlüssels).
- Speicherung nur als Hash mit Argon2id (mind. 19 MiB, 2 Iterationen, Parallelität 1) und Salt, wie OWASP Password Storage Cheat Sheet.
- Eingaben in den Hash (Vorgabe Muri, 21.10.2026):
  - Passwort (Klartext, nur im Arbeitsspeicher),
  - **zufälliger Salt** je Konto (16 Byte, kryptografisch zufällig), bleibt Pflicht, siehe Begründung,
  - **Benutzername** (klein geschrieben, Unicode-NFC) und **Erstellungstag des Kontos** (UTC, `YYYY-MM-DD`) als Argon2-Eingabe `"tabula:v1:" + benutzername + ":" + erstellungstag`.
  - Umsetzung (server/src/password.ts): als Argon2-Parameter **`secret`**, nicht als „associated data“. Grund: Das npm-Paket `argon2` legt „associated data“ im gespeicherten Hash ab und verwendet beim Prüfen den gespeicherten Wert, die Bindung ans Konto würde also nicht erzwungen. `secret` wird nicht gespeichert und muss beim Prüfen stimmen. Test belegt: Hash von Konto A schlägt bei Konto B fehl.
- Gespeichert werden Hash, Salt und Parameter (PHC-Format). Erstellungstag liegt ohnehin im Konto.
- Folgen:
  - Ein kopierter Hash passt nur zu genau diesem Konto (anderer Benutzername oder Tag = ungültig).
  - **Benutzername ändern** geht nur mit Eingabe des aktuellen Passworts, dann wird neu gehasht.
  - Lehrkraft setzt Passwort eines Schülers zurück: neuer Hash mit demselben Benutzernamen und Tag.
- Begründung, warum der zufällige Salt bleibt: Benutzername + Tag sind vorhersehbar. Allein als Salt könnte ein Angreifer für bekannte Konten vorab rechnen. Als zusätzliche Eingabe schaden sie nicht und binden den Hash an das Konto.
- Klartext-Passwörter werden nie gespeichert oder protokolliert.
- Test: gleicher Benutzername + Passwort an zwei Tagen ergibt verschiedene Hashes; Hash von Konto A schlägt bei Konto B fehl; Umbenennen ohne Passwort wird abgelehnt.

## K4 Klassen und Lernfortschritt
- Beitritt nur per Klassencode oder QR-Code, durch Handlung des Schülers.
- Gespeichert je Schüler: Klassenzugehörigkeit, je Lektion und Schritt: erledigt ja/nein, Anzahl Versuche, Zeitpunkt.
- Für „hängt fest“: nur die **letzte** Abfrage und Fehlermeldung je Übung, im Browser des Schülers mit dem öffentlichen Schlüssel der Lehrkraft verschlüsselt. Der Server sieht nur, ob der letzte Versuch einen Fehler hatte. Wird beim nächsten Versuch überschrieben.
- Sichtbar nur für die Lehrkraft dieser Klasse. Keine Sichtbarkeit für andere Schüler (Ausnahme Quiz-Rangliste am Beamer, K5).
- Beim ersten Klassen-Login wird der bisher im Browser gespeicherte Fortschritt (`tabula-progress`) einmalig übernommen.

## K5 Live-Quiz
- Nur innerhalb einer Klasse, nur für angemeldete Schüler dieser Klasse.
- Gespeichert während des Quiz: Teilnahme, gewählte Antwort je Frage, Antwortzeit, Punkte. Kein Name beim Server.
- Rangliste mit Namen nur am Beamer: Die Namen entschlüsselt der Browser der Lehrkraft. Auf dem Handy sieht jeder Schüler nur seinen eigenen Platz.
- Einzelne Antworten und Punkte werden 24 Stunden nach Quiz-Ende gelöscht. Danach bleibt nur die Auswertung je Frage ohne Namen (Anteil richtig).
- Echtzeit über WebSocket zum eigenen Server, kein Drittanbieter.

## K6 Anmelde-Cookie
- Ein einziges Cookie `tabula_session`: zufällige Sitzungs-ID, `HttpOnly`, `Secure`, `SameSite=Lax`, nur für www.tabulasql.de.
- Wird erst beim Anmelden gesetzt, beim Abmelden gelöscht, läuft nach 30 Tagen ab.
- Keine anderen Cookies.

## K7 E-Mails
- Nur Systemmails an Lehrkräfte: Passwort zurücksetzen (Link 1 Stunde gültig, einmalig nutzbar), Bestätigung der E-Mail-Adresse, Hinweis vor automatischer Löschung. Schüler bekommen keine Mails.
- Versand über den Mailserver von Hetzner (Absender noreply@tabulasql.de, Port 587 mit STARTTLS). Keine Newsletter, keine Werbung.
- Umgesetzt (21.10.2026): Bestätigungslink 24 Stunden gültig, einmalig, nur SHA-256 des Tokens gespeichert, abgelaufene Token löscht der Aufräumjob. Belegt durch `tests/email-verify.test.ts`.

## K8 Löschung
- Lehrkraft-Konto jederzeit selbst löschbar (Einstellungen), Löschung sofort mit allen Klassen und deren Daten.
- Schüler tritt selbst aus der Klasse aus: alle seine Daten werden sofort gelöscht.
- Lehrkraft entfernt Schüler aus Klasse: alle Daten dieses Schülers werden gelöscht.
- Klasse gelöscht: alle Schüler der Klasse und deren Daten werden gelöscht.
- Lehrkraft-Konten und Schüler ohne Anmeldung seit 12 Monaten werden automatisch gelöscht (Lehrkräfte bekommen 30 Tage vorher einen Hinweis per E-Mail).
- Sicherungskopien der Datenbank: verschlüsselt, auf dem Server in Deutschland, höchstens 7 Tage aufbewahrt. Gelöschte Daten verschwinden spätestens dann auch aus den Sicherungen.

## K9 Kein Tracking, kein Profiling
- Keine Analyse-, Werbe- oder Tracking-Dienste, keine Weitergabe an Dritte, keine automatisierten Entscheidungen.
- Fortschrittsdaten dienen nur dem Lernen und der Unterstützung durch die Lehrkraft, nicht der Benotung durch Tabula.

## K10 Anmeldeschutz
- Begrenzung der Anmeldeversuche nur im Arbeitsspeicher (keine dauerhafte Speicherung von IP-Adressen): Lehrkräfte je Konto, Schüler je Klasse (der Server kennt keine Schülernamen).
- Zugriffsprotokoll bleibt aus (siehe Caddyfile), Server-Protokolle max. 14 Tage, IPs gekürzt.

## K11 Ort
- Alle Daten liegen auf dem Server bei Hetzner in Nürnberg. Keine Übermittlung in Drittländer.

## K12 Schulen
- Setzt eine Schule Tabula verbindlich im Unterricht ein, ist sie nach Auffassung der Aufsichtsbehörden die verantwortliche Stelle. Dann schließen wir mit ihr einen Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO).
- Bei Selbst-Hosting (Docker an der Schule) ist allein die Schule verantwortlich, Daten erreichen uns nicht.

## Prüfpunkte vor dem Start der Konten (Freigabe-Checkliste)
Stand 21.10.2026. Belege sind Tests in `server/tests/` (ausführen: `cd server && npm test`) oder Prüfungen auf dem Server.
- [x] K1/K2: Formularfelder und Datenbankschema entsprechen genau der Liste. Beleg: `migrations/0001_users.sql` (keine Spalten für Geburtsdatum, Geschlecht, IP), Tests „K1/K2: Registrierung und Schema“ (Pflichtfelder, Lehrkraft ohne E-Mail abgelehnt).
- [x] K3: Argon2id-Parameter im Code, Test „Passwort taucht in keinem Log auf“. Beleg: `k3-password.test.ts` (Parameter, Bindung an Konto und Tag), `log-audit.test.ts` (kompletter Durchlauf: kein Passwort, Token, Abfragetext, Name, E-Mail, IP im Log), `change-password.test.ts`.
- [x] K4: Lehrkraft A sieht keine Schüler aus Klasse von Lehrkraft B (Test). Beleg: `teacher.test.ts` „Isolation: Lehrkraft A vs B“ (Klasse, Schüler, Dashboard, Matrix, letzte Abfrage, Passwort-Reset, Erledigt-Markieren: jeweils 404).
- [x] K5: Löschjob 24 h nach Quiz-Ende (Test mit Zeitreise). Beleg: `quiz.test.ts` „K5: 24h Loeschjob“ (nach 24 h nur Aggregat ohne Namen, vorher nichts gelöscht).
- [ ] K6: Ein Cookie, Attribute geprüft im Browser. Automatisch belegt durch „K6: Cookie-Attribute“ (HttpOnly, Secure, SameSite=Lax, 30 Tage, Löschen beim Abmelden) und über Caddy im Abnahmelauf (HttpOnly, SameSite=Lax, Max-Age 30 Tage; „Secure“ dort bewusst aus, weil der Probelauf über http lief, in Produktion ist es Standard). **Offen:** Sichtprüfung im echten Browser über https nach dem Freischalten (Entwicklerwerkzeuge, Anwendung, Cookies), durch den Betreiber.
- [x] K8: Konto löschen entfernt alle Zeilen (Test), Inaktivitätsjob, Backup-Rotation 7 Tage. Belegt: „K8: Konto loeschen entfernt alle Zeilen“, „K8: Klasse loeschen“, „K8: Schueler aus Klasse entfernen“, Quiz-Daten, Inaktivitätsjob (`jobs.test.ts`). Sicherung (`deploy/backup.sh`, systemd-Timer täglich 03:15 UTC) am 21.10.2026 auf dem Server geprüft: Schnappschuss im laufenden Container, verschlüsselt mit age an den öffentlichen Schlüssel des Betreibers (der Server selbst kann nicht entschlüsseln, getestet), Wiederherstellung auf dem Laptop getestet (alle 16 Tabellen, Testzeile vorhanden), Rotation getestet (Dateien ab 7 Tagen werden gelöscht). Testdaten danach entfernt.
- [x] K10: Keine IP in Datenbank (Test). Beleg: „K10: Keine IP in Datenbank“ (users, sessions, classes, Quiz-Tabellen), `log-audit.test.ts`.
- [x] Betrieb geprüft (21.10.2026): API-Image baut auf dem Server, läuft als Nutzer 10001 mit schreibgeschütztem Dateisystem, Datenbank im Volume, Healthcheck grün. Noch nicht an Caddy angeschlossen.
- [x] Abnahme auf dem Produktionsserver (21.10.2026, `tools/acceptance-api.mjs`): echtes API-Image hinter einer separaten Caddy-Instanz mit dem Go-live-Block aus `deploy/Caddyfile.api` (nur 127.0.0.1, eigenes Netz, danach vollständig entfernt). 27 von 27 Prüfungen bestanden: Registrierung Lehrkraft und Schüler, Cookie-Attribute über Caddy, CSRF-Ablehnung, Klasse und Beitritt, Fokus beim Schüler, Schüler ohne Zugriff aufs Lehrer-Dashboard, „hängt fest“ und letzte Abfrage, Fortschritt auf zweitem Gerät, fremde Lehrkraft 404, Quiz aus der Fragenbank über WebSocket durch Caddy (Cookie-Anmeldung, Gast abgelehnt, Lösung erst bei Auflösung, doppelte Antwort verworfen, Punkte nur bei richtiger Antwort), Auswertung, Konto löschen, Abmelden. Danach im echten Container geprüft: Protokoll ohne Passwörter, Abfragen, Fehlermeldungen, E-Mail-Adressen, Namen, Cookies, IPs; Datenbank ohne IP-/Adressspalten, alle Passwörter Argon2id m=19456 t=2 p=1, Sitzungen nur als SHA-256; Sicherung des laufenden Containers erstellt und auf dem Laptop wiederhergestellt. Testdaten danach gelöscht.
- [x] Vertrag Frontend und Server: `server/tests/contract.test.ts` ruft die echten Client-Funktionen (`src/lib/tabula/api.ts`, `quiz-api.ts`) gegen den echten Server auf; Gegenprobe mit absichtlich falschem Pfad schlägt fehl.
- [ ] Danach `ACCOUNTS_LIVE` einschalten (Build-Variable `VITE_ACCOUNTS_LIVE=1`, siehe `src/lib/tabula/flags.ts`) und in Caddy `handle /api/*` auf `api:3000` aktivieren.
- [ ] Rechtliche Restfragen unten mit Fachanwalt geklärt.

## Rechtliche Restfragen (vor Start mit Fachanwalt klären)
- Rechtsgrundlage Art. 6 Abs. 1 lit. b DSGVO für Konten Minderjähriger: Wirksamkeit des Nutzungsvertrags bei unter 18-Jährigen (BGB), alternativ Einwilligung mit Art. 8 DSGVO (Altersgrenze 16 in Deutschland).
- Rolle der Schule (K12): Die DSK-Orientierungshilfe Lernplattformen sieht die Schule als verantwortlich, wenn sie die Plattform einsetzt. Freiwillige Nutzung durch einzelne Lehrkräfte genauer abgrenzen.
