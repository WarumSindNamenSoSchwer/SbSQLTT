# Backend: Datenschutz-Vorgaben (verbindlich)

Stand: 21.10.2026. Diese Datei legt fest, **welche Daten das Backend (Konten, Klassen, Live-Quiz) verarbeiten darf und wie lange**.
Die Datenschutzerklärung (`src/lib/tabula/privacy.ts`, Quellen-IDs K1 bis K12) beschreibt genau diese Vorgaben.
Weicht die Umsetzung ab, muss zuerst diese Datei und dann die Erklärung geändert werden. Jede Vorgabe hat unten einen Prüfpunkt.

## K1 Schülerkonto
- Pflicht: Benutzername, Anzeigename, Passwort. Beides darf ein Fantasiename sein, die Seite fordert keinen echten Namen.
- Optional: E-Mail-Adresse, nur für das Zurücksetzen des Passworts.
- Optional: Klassencode beim Registrieren (dann K4).
- Keine weiteren Pflichtfelder (kein Geburtsdatum, keine Schule, kein Geschlecht).

## K2 Lehrkraftkonto
- Pflicht: Name, E-Mail-Adresse, Passwort, Bestätigung der Nutzungsbedingungen.
- Optional: Schule.

## K3 Passwörter
- Speicherung nur als Hash mit Argon2id (mind. 19 MiB, 2 Iterationen, Parallelität 1) und Salt, wie OWASP Password Storage Cheat Sheet.
- Eingaben in den Hash (Vorgabe Muri, 21.10.2026):
  - Passwort (Klartext, nur im Arbeitsspeicher),
  - **zufälliger Salt** je Konto (16 Byte, kryptografisch zufällig) – bleibt Pflicht, siehe Begründung,
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
- Für „hängt fest“: nur die **letzte** Abfrage und Fehlermeldung je Übung. Wird beim nächsten Versuch überschrieben.
- Sichtbar nur für die Lehrkraft(en) dieser Klasse. Keine Sichtbarkeit für andere Schüler (Ausnahme Quiz-Rangliste K5).
- Ohne Klasse: Fortschritt wird nur zum Abgleich zwischen Geräten gespeichert, niemand sonst sieht ihn.
- Beim ersten Anmelden wird der bisher im Browser gespeicherte Fortschritt (`tabula-progress`) einmalig übernommen.

## K5 Live-Quiz
- Gespeichert während des Quiz: Teilnahme, gewählte Antwort je Frage, Antwortzeit, Punkte.
- Rangliste zeigt Anzeigenamen der Teilnehmenden im Raum (Beamer).
- Einzelne Antworten und Punkte werden 24 Stunden nach Quiz-Ende gelöscht. Danach bleibt nur die Auswertung je Frage ohne Namen (Anteil richtig).
- Echtzeit über WebSocket zum eigenen Server, kein Drittanbieter.

## K6 Anmelde-Cookie
- Ein einziges Cookie `tabula_session`: zufällige Sitzungs-ID, `HttpOnly`, `Secure`, `SameSite=Lax`, nur für www.tabulasql.de.
- Wird erst beim Anmelden gesetzt, beim Abmelden gelöscht, läuft nach 30 Tagen ab.
- Keine anderen Cookies.

## K7 E-Mails
- Nur Systemmails: Passwort zurücksetzen (Link 1 Stunde gültig, einmalig nutzbar), Bestätigung der E-Mail-Adresse von Lehrkräften.
- Versand über den Mailserver von Hetzner (Absender kontakt@tabulasql.de). Keine Newsletter, keine Werbung.

## K8 Löschung
- Konto jederzeit selbst löschbar (Einstellungen), Löschung sofort mit allen Fortschritts- und Quizdaten.
- Lehrkraft entfernt Schüler aus Klasse: Zugehörigkeit und klassenbezogener Fortschritt werden gelöscht.
- Klasse gelöscht: alle Zugehörigkeiten und klassenbezogenen Daten werden gelöscht.
- Konten ohne Anmeldung seit 12 Monaten werden automatisch gelöscht (mit Hinweis per E-Mail 30 Tage vorher, falls E-Mail hinterlegt).
- Sicherungskopien der Datenbank: verschlüsselt, auf dem Server in Deutschland, höchstens 7 Tage aufbewahrt. Gelöschte Daten verschwinden spätestens dann auch aus den Sicherungen.

## K9 Kein Tracking, kein Profiling
- Keine Analyse-, Werbe- oder Tracking-Dienste, keine Weitergabe an Dritte, keine automatisierten Entscheidungen.
- Fortschrittsdaten dienen nur dem Lernen und der Unterstützung durch die Lehrkraft, nicht der Benotung durch Tabula.

## K10 Anmeldeschutz
- Begrenzung der Anmeldeversuche pro Konto und Adresse nur im Arbeitsspeicher (keine dauerhafte Speicherung von IP-Adressen).
- Zugriffsprotokoll bleibt aus (siehe Caddyfile), Server-Protokolle max. 14 Tage, IPs gekürzt.

## K11 Ort
- Alle Daten liegen auf dem Server bei Hetzner in Nürnberg. Keine Übermittlung in Drittländer.

## K12 Schulen
- Setzt eine Schule Tabula verbindlich im Unterricht ein, ist sie nach Auffassung der Aufsichtsbehörden die verantwortliche Stelle. Dann schließen wir mit ihr einen Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO).
- Bei Selbst-Hosting (Docker an der Schule) ist allein die Schule verantwortlich, Daten erreichen uns nicht.

## Prüfpunkte vor dem Start der Konten (Freigabe-Checkliste)
- [ ] K1/K2: Formularfelder und Datenbankschema entsprechen genau der Liste.
- [ ] K3: Argon2id-Parameter im Code, Test „Passwort taucht in keinem Log auf“.
- [ ] K4: Lehrkraft A sieht keine Schüler aus Klasse von Lehrkraft B (Test).
- [ ] K5: Löschjob 24 h nach Quiz-Ende (Test mit Zeitreise).
- [ ] K6: Ein Cookie, Attribute geprüft im Browser.
- [ ] K8: Konto löschen entfernt alle Zeilen (Test), Inaktivitätsjob, Backup-Rotation 7 Tage.
- [ ] K10: Keine IP in Datenbank (Test).
- [ ] Danach `ACCOUNTS_LIVE = true` in `privacy.ts`.

## Rechtliche Restfragen (vor Start mit Fachanwalt klären)
- Rechtsgrundlage Art. 6 Abs. 1 lit. b DSGVO für Konten Minderjähriger: Wirksamkeit des Nutzungsvertrags bei unter 18-Jährigen (BGB), alternativ Einwilligung mit Art. 8 DSGVO (Altersgrenze 16 in Deutschland).
- Rolle der Schule (K12): Die DSK-Orientierungshilfe Lernplattformen sieht die Schule als verantwortlich, wenn sie die Plattform einsetzt. Freiwillige Nutzung durch einzelne Lehrkräfte genauer abgrenzen.
