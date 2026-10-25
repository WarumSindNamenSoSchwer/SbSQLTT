# Tabula: Datenübersicht und Fragen

Stand: 25.10.2026. Beschreibt den Stand, mit dem die Konten online gehen sollen. Bisher ist nur die Website ohne Konten online.

## Teil 1: Welche Daten

Allgemein: Server bei Hetzner in Nürnberg, Mails ebenfalls über Hetzner, AV-Vertrag besteht. Keine Weitergabe, keine Drittländer, kein Tracking, keine Werbung. Ohne Anmeldung keine Cookies.

### 1. Aufruf der Website
- Daten: IP-Adresse, aufgerufene Adresse, Zeitpunkt, Browserangaben
- Zweck: Seite ausliefern, Fehler und Angriffe erkennen
- Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO
- Speicherung: nur im Arbeitsspeicher, kein Zugriffsprotokoll. Fehlermeldungen landen mit gekürzter IP (IPv4 /24, IPv6 /48) in einer Protokolldatei.
- Dauer: Protokolle höchstens 14 Tage
- Wer sieht es: nur ich

### 2. Speicherung im Browser
- Daten: Lernfortschritt, helle oder dunkle Darstellung, geschlossene Hinweise. Bei angemeldeten Schülern der eigene Name im Tab-Speicher (für die Begrüßung und zum Ändern von Name oder Passwort). Bei angemeldeten Lehrkräften der entschlüsselte Schlüssel, damit sie die Namen ihrer Schüler lesen kann.
- Zweck: Fortschritt ohne Anmeldung merken, Anmeldung bedienen
- Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG
- Speicherung: nur im Browser, wird nicht an mich übertragen. Beim ersten Klassen-Login wird der Fortschritt einmalig in die Klasse übernommen.
- Dauer: Fortschritt bis der Nutzer ihn im Browser löscht. Name des Schülers bis zum Schließen des Tabs oder Abmelden. Schlüssel der Lehrkraft bis zum Abmelden.

### 3. Kontaktformular und E-Mail
- Daten: Name, E-Mail, Schule (freiwillig), Nachricht
- Zweck: Anfrage beantworten
- Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO, bei Lehrkräften mit Bezug zur Nutzung lit. b
- Speicherung: nicht auf dem Webserver, wird als Mail an mein Postfach bei Hetzner weitergeleitet. Die IP wird nur im Arbeitsspeicher als Hash gehalten, um Massen-Einsendungen zu bremsen (3 je 10 Minuten).
- Dauer: Mail bis erledigt, höchstens 6 Monate
- Wer sieht es: nur ich

### 4. Lehrkraft-Konto
- Daten: Name, E-Mail (wird per Link bestätigt), Passwort als Hash (Argon2id), Schule (freiwillig), Zeitpunkt von Registrierung und letzter Anmeldung, Schlüsselpaar der Lehrkraft (öffentlicher Teil offen, privater Teil mit ihrem Passwort und ihrem Wiederherstellungscode verschlüsselt, für mich nicht lesbar)
- Zweck: Konto bereitstellen, Klassen und Quiz verwalten
- Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
- Speicherung: Datenbank auf dem Server
- Dauer: bis die Lehrkraft das Konto löscht, sonst automatisch nach 12 Monaten ohne Anmeldung (Hinweis-Mail 30 Tage vorher)
- Wer sieht es: nur ich (technisch)

### 5. Schüler (Klassen-Login)
Es gibt keine Schülerkonten. Schüler treten per QR-Code einer Klasse bei und melden sich danach an jedem PC mit Klassencode, Name und eigenem Passwort an. Der Browser macht daraus einen Schlüssel. Name und Passwort verlassen den PC nie. Den Namen verschlüsselt der Browser des Schülers mit dem öffentlichen Schlüssel der Lehrkraft.
- Daten beim Server: zufällige Nummer, Klasse, Prüfwert des Login-Schlüssels, verschlüsselter Name, verschlüsselte letzte Abfrage mit Fehlermeldung, ob der letzte Versuch einen Fehler hatte, je Übung erledigt ja/nein, Anzahl Versuche, Zeitpunkt, letzte Anmeldung
- Nicht beim Server: Klarname, Passwort, E-Mail, Alter
- Zweck: Fortschritt auf jedem PC, Lehrkraft sieht, wo jemand festhängt
- Rechtsgrundlage: bisher Art. 6 Abs. 1 lit. b DSGVO, siehe Fragen 1 und 2
- Dauer: bis der Schüler austritt, die Lehrkraft ihn entfernt oder die Klasse löscht, sonst 12 Monate nach der letzten Anmeldung. Die letzte Abfrage wird bei jedem Versuch überschrieben.
- Wer sieht es: die Lehrkraft der Klasse. Ich sehe nur Nummern und Fortschritt.
- Passwort vergessen: Die Lehrkraft erzeugt einen Einmal-Code (15 Minuten gültig), damit legt der Schüler ein neues Passwort fest.

### 6. Live-Quiz (nur innerhalb einer Klasse)
- Daten: Teilnahme, Antwort je Frage, Antwortzeit, Punkte
- Zweck: Quiz im Unterricht, Rangliste am Beamer (die Namen entschlüsselt nur der Browser der Lehrkraft). Auf dem Handy sieht jeder Schüler nur seinen eigenen Platz.
- Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
- Dauer: einzelne Antworten 24 Stunden nach Quiz-Ende, danach nur der Anteil richtiger Antworten je Frage ohne Bezug zu Schülern
- Wer sieht es: Lehrkraft, die Klasse sieht die Rangliste im Raum

### 7. Anmelde-Cookie
- Daten: zufällige Sitzungskennung, beim Server nur als Hash
- Zweck: angemeldet bleiben
- Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. b DSGVO
- Dauer: bis zum Abmelden, höchstens 30 Tage
- Sonst: erst nach der Anmeldung gesetzt, für Skripte nicht lesbar, nur über HTTPS, nur für www.tabulasql.de

### 8. System-Mails (nur an Lehrkräfte)
- Inhalt: E-Mail bestätigen (Link 24 Stunden gültig), Passwort zurücksetzen (Link 1 Stunde gültig), Hinweis vor automatischer Löschung
- Versand: von noreply@tabulasql.de über Hetzner, keine Werbung

### 9. Sicherungen
- Datenbank täglich, verschlüsselt mit einem Schlüssel, der nur auf meinem Laptop liegt (der Server selbst kann die Sicherung nicht öffnen)
- Dauer: 7 Tage

Sicherheit allgemein: HTTPS, Server-Zugang nur per SSH-Schlüssel, kein Root-Login, automatische Sicherheitsupdates, Sperre nach Fehlversuchen, Dienste ohne Sonderrechte, keine IP-Adressen in der Datenbank.

## Teil 2: Fragen

1. Klassen-Login: Ich sehe von Schülern nur Nummern und Fortschritt, keine Namen. Sind das für mich überhaupt personenbezogene Daten (EuGH C-413/23 P)? Den privaten Schlüssel erzeugt der Browser der Lehrkraft, ich bekomme ihn nur verschlüsselt und kann ihn nicht lesen. Das Programm dafür kommt allerdings von meinem Server. Der Quellcode ist öffentlich.
2. Falls ja: Reicht Art. 6 Abs. 1 lit. b DSGVO, obwohl die meisten Schüler minderjährig sind (§§ 107 ff. BGB)? Oder brauche ich eine Einwilligung nach Art. 8 DSGVO, unter 16 also durch die Eltern?
3. Lehrkraft nutzt Tabula ohne Beschluss der Schule: Bin ich allein verantwortlich, brauche ich einen AV-Vertrag mit der Schule, oder ist es gemeinsame Verantwortung nach Art. 26 DSGVO?
4. Muss die Schulleitung den Einsatz freigeben? Falls ja: Muss ich Lehrkräfte bei der Registrierung darauf hinweisen?
5. Lehrkraft sieht je Schüler und Übung die letzte Abfrage mit Fehlermeldung (verschlüsselt, nur sie kann es lesen). Passt das so?
6. Passwort vergessen bei Schülern: Die Lehrkraft erzeugt einen Einmal-Code (15 Minuten gültig), der Schüler legt damit selbst ein neues Passwort fest. Passt das so?
7. Quiz-Rangliste mit Namen am Beamer: Passt das so, oder brauche ich eine Einwilligung oder eine anonyme Teilnahme?
8. Impressum (tabulasql.de/impressum): Reicht das so?
9. Die Datenschutzerklärung (tabulasql.de/datenschutz) beschreibt noch die alten Schülerkonten und wird an diese Übersicht angepasst. Muss darüber hinaus etwas rein?
10. Nutzungsbedingungen gibt es keine. Lehrkräfte bestätigen bei der Registrierung nur, dass sie die Datenschutzhinweise gelesen haben. Brauche ich welche, und wenn ja, was muss rein?
11. Reicht Teil 1 als Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 DSGVO, oder fehlt etwas?
