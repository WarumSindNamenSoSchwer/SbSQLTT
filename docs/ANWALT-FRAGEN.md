# Tabula: Fragen an die Rechtsberatung vor dem Start der Konten

Stand: 21.10.2026. Verantwortlicher: Murat-Can Meric (Privatperson), Lübecker Str. 45, 10559 Berlin, kontakt@tabulasql.de.
Website: https://www.tabulasql.de (Datenschutzerklärung: https://www.tabulasql.de/datenschutz).
Der Quellcode ist offen (AGPL-3.0). Technische Vorgaben und Belege: `docs/BACKEND-DATENSCHUTZ.md`, Quellen: `docs/DATENSCHUTZ-QUELLEN.md`.

## Was Tabula ist
- Kostenloser SQL-Lerntrainer für den Informatikunterricht an Gymnasien, ab Klasse 10 (meist 15 bis 16 Jahre, teils jünger).
- Kein Geld, keine Werbung, kein Tracking, keine Weitergabe an Dritte. Kein Gewinnstreben.
- Alle Lektionen funktionieren ohne Konto. Fortschritt bleibt dann nur im Browser.
- Hosting ausschließlich bei Hetzner (Nürnberg/Falkenstein), AV-Vertrag nach Art. 28 DSGVO abgeschlossen. Mail ebenfalls über Hetzner.

## Was mit Konten dazukommt (noch nicht freigeschaltet)
| Bereich | Daten | Wer sieht es |
|---|---|---|
| Schülerkonto (freiwillig) | Benutzername, Anzeigename (beides darf ausgedacht sein), Passwort-Hash, optional E-Mail nur für Passwort-Reset, Zeitpunkte Registrierung und letzte Anmeldung | nur der Schüler |
| Lehrkraftkonto | Name, E-Mail (wird bestätigt), Passwort-Hash, optional Schule, Zustimmung zu Nutzungsbedingungen | nur die Lehrkraft |
| Klasse (Beitritt nur durch Handlung des Schülers per Code/QR) | Mitgliedschaft; je Übung erledigt ja/nein, Anzahl Versuche, Zeitpunkt; nur die letzte Abfrage und Fehlermeldung je Übung (wird überschrieben) | Lehrkraft dieser Klasse |
| Live-Quiz (nur mit Konto) | Teilnahme, gewählte Antwort, Antwortzeit, Punkte; Rangliste mit Anzeigenamen im Raum (Beamer) | Teilnehmende im Raum; Einzelantworten nach 24 h gelöscht, danach nur Anteil richtig je Frage ohne Namen |
| Cookie | ein Sitzungs-Cookie `tabula_session` (HttpOnly, Secure, SameSite=Lax, 30 Tage), erst nach Anmeldung | technisch nötig |

Löschung: Konto jederzeit selbst sofort löschbar; Inaktivität 12 Monate führt zur Löschung (Hinweis 30 Tage vorher, falls E-Mail); Sicherungen verschlüsselt, höchstens 7 Tage.
Keine IP-Adressen in der Datenbank, kein Zugriffsprotokoll, Server-Protokolle höchstens 14 Tage mit gekürzten IPs.

## Fragen

### 1. Rechtsgrundlage für Konten Minderjähriger
Die Datenschutzerklärung stützt Konten derzeit auf Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des freiwillig angelegten Kontos).
- Trägt lit. b bei 15- bis 17-Jährigen (und ggf. jüngeren), obwohl der Nutzungsvertrag nach BGB ggf. schwebend unwirksam ist (§§ 107 ff. BGB)? Hilft § 110 BGB oder die Unentgeltlichkeit und rein rechtliche Vorteilhaftigkeit?
- Falls nicht: Ist Einwilligung nach Art. 6 Abs. 1 lit. a in Verbindung mit Art. 8 DSGVO nötig (in Deutschland Altersgrenze 16)? Brauchen wir dann für unter 16-Jährige die Zustimmung der Eltern, und wie wäre die nach Art. 8 Abs. 2 „mit angemessenen Anstrengungen“ zu prüfen, ohne Alter oder Klarnamen zu erheben?
- Alternative: Kann die Nutzung im Unterricht über die Schule laufen (siehe 2), sodass die Schule die Grundlage liefert (Schulgesetz, Art. 6 Abs. 1 lit. e)?

### 2. Rolle der Schule und der einzelnen Lehrkraft
- Die DSK-Orientierungshilfe zu Lernplattformen sieht die Schule als verantwortlich, wenn sie die Plattform einsetzt. Wie ist es, wenn eine einzelne Lehrkraft Tabula freiwillig nutzt und die Klasse beitritt, ohne Beschluss der Schule?
- Brauchen wir in diesem Fall einen Vertrag zur Auftragsverarbeitung mit der Schule, gemeinsame Verantwortlichkeit (Art. 26) oder bleiben wir allein verantwortlich?
- Muss Tabula für den Einsatz an Berliner (bzw. anderen Länder-)Schulen auf einer Positivliste stehen oder von der Schulleitung freigegeben werden? Sollen wir Lehrkräfte darauf hinweisen?

### 3. Sichtbarkeit für die Lehrkraft
- Die Lehrkraft sieht je Schüler die letzte SQL-Abfrage und Fehlermeldung je Übung, um zu helfen („hängt fest“). Ist das mit Blick auf Datenminimierung und Leistungskontrolle zulässig, und reicht der Hinweis in der Datenschutzerklärung?
- Die Lehrkraft kann das Passwort eines Schülers ihrer Klasse auf ein Einmal-Passwort zurücksetzen (Schüler muss es beim nächsten Login ändern). Bedenken?

### 4. Live-Quiz
- Rangliste mit Anzeigenamen auf dem Beamer vor der Klasse: zulässig auf Grundlage lit. b oder braucht es eine gesonderte Einwilligung oder eine Möglichkeit, anonym teilzunehmen?

### 5. Impressum und Datenschutzerklärung
- Reicht das Impressum einer Privatperson ohne Gewinnabsicht (Angaben nach § 5 DDG) in der jetzigen Form?
- Gibt es Punkte in der Datenschutzerklärung, die vor dem Start der Konten angepasst werden müssen (insbesondere die Abschnitte „Konten“, „Klassen“, „Live-Quiz“, „Hinweis für Schüler und Eltern“)?
- Nutzungsbedingungen für Lehrkräfte: Gibt es Mindestinhalte (z. B. Zusicherung, dass die Schule den Einsatz erlaubt)? Derzeit gibt es **keine** Nutzungsbedingungen; die Lehrkraft bestätigt bei der Registrierung nur, die Datenschutzhinweise gelesen zu haben (das ist bewusst keine Einwilligung). K2 sieht eine Bestätigung von Nutzungsbedingungen vor: Brauchen wir sie, und wenn ja, mit welchem Inhalt?

## Was bereits umgesetzt und geprüft ist
Siehe Freigabe-Checkliste in `docs/BACKEND-DATENSCHUTZ.md` (Tests für Datenminimierung, Löschung, Trennung zwischen Klassen, keine IPs, keine personenbezogenen Daten in Protokollen, verschlüsselte Sicherung mit Wiederherstellungstest).
