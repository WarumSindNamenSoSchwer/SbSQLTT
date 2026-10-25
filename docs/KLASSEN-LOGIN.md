# Klassen-Login (Plan)

Stand: 25.10.2026. Ersetzt die Schülerkonten. Lehrkraft-Konten bleiben.

## Ziel
Der Betreiber hält nie Namen oder Passwörter von Schülern. Auf dem Server liegen pro Schüler nur Kennung, Klasse, Fortschritt und verschlüsselte Daten, die nur die Lehrkraft lesen kann.

## Ablauf Schüler
- **Beitritt:** QR-Code scannen (Klassencode vorausgefüllt), Name und eigenes Passwort (mind. 8 Zeichen) eingeben. Kein Startpasswort.
- **Anmelden an jedem PC:** Klassencode (`blau-tiger-42`), Name, Passwort.
- **Profil:** Fortschritt, Passwort ändern, Namen ändern, aus Klasse austreten.
- **Passwort vergessen:** Lehrkraft erzeugt Einmal-Code (15 Minuten). Schüler gibt Klassencode, Name, Code und neues Passwort ein. Fortschritt bleibt.
- **Quiz:** QR füllt Klasse und Quiz aus, Schüler gibt Name und Passwort ein.

## Technik
- Browser: `schlüssel = Argon2id(Passwort, Salz aus Klassencode + Name)`, etwa 1 Sekunde. Name und Passwort verlassen den PC nie.
- Server speichert nur `SHA-256(schlüssel)` und vergleicht. Passwort oder Name ändern: alter Schlüssel wird gegen neuen getauscht.
- Klasse hat ein Schlüsselpaar, erzeugt im Browser der Lehrkraft. Der Schüler-Browser verschlüsselt Namen und letzte Abfrage mit dem öffentlichen Teil.
- Der private Teil liegt zweimal verschlüsselt beim Server: mit dem Passwort der Lehrkraft und mit ihrem Wiederherstellungscode.
- Lehrkraft-Passwort vergessen: E-Mail-Reset wie bisher. Mit Wiederherstellungscode sind die Namen sofort wieder da, ohne Code kommen sie zurück, sobald sich die Schüler wieder anmelden (neues Schlüsselpaar).
- Gleicher Name in einer Klasse: Hinweis „Name schon vergeben“.

## Schutz gegen Raten
1. Passwort mindestens 8 Zeichen.
2. Fehlversuche begrenzen **je Klasse und Name** (nicht je IP, weil eine ganze Schule hinter einer IP sitzt).
3. Langsame Ableitung im Browser (Argon2id, Ziel etwa 1 Sekunde).

Restrisiko: Wer die Datenbank hat und Klassencode und Namen kennt, kann schwache Passwörter offline raten. Wird so akzeptiert.

## Last: 4 Klassen à 30 Schüler gleichzeitig
- Die teure Rechnung (Argon2) läuft im Browser jedes Schülers, nicht auf dem Server.
- Der Server macht pro Anmeldung nur einen SHA-256-Vergleich und eine Datenbankabfrage, Bruchteile einer Millisekunde.
- Abnahme: Lasttest mit 120 gleichzeitigen Anmeldungen plus Fortschritt laden gegen das echte Image auf dem Server (CAX11, 2 Kerne, 4 GB). Ziel: alle unter 1 Sekunde Serverzeit, kein Fehler.

## Was wegfällt
Schüler-Registrierung, Benutzername, E-Mail von Schülern, E-Mail-Reset für Schüler, Einmal-Passwort, `/beitreten` als eigener Schritt.

## Was bleibt
Fortschritt am Server, Fokus und gesperrte Lektionen, Quiz mit Rangliste (Namen entschlüsselt der Browser der Lehrkraft), Löschung nach 12 Monaten Inaktivität, Lehrkraft-Konten.

## Offen
- Argon2-Dauer im echten Browser auf Schul-PCs messen (WASM), Parameter danach festlegen.
- Datenschutzerklärung und Anwaltsbrief anpassen (Anwaltsbrief erst nach Rücksprache).
