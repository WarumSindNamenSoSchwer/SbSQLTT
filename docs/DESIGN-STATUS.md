# Design-Status (Stand Review 3, 2026-10-21)

> **Neuer Name:** Projekt heißt jetzt **Tabula**, die Eule heißt **Edgar**.

Abgleich der Designer-Lieferung mit [`DESIGN-SPEC.md`](./DESIGN-SPEC.md).

## Fertig

- [x] Design-System v3, Eule (23 Posen, 24 Animationen, Icons)
- [x] A1 Startseite (v11)
- [x] A2 Lektionsübersicht: Erstbesuch, Fortgeschritten mit Fokus + gesperrt, Dunkel, Mobil
- [x] B2 Lektionsseite: alle Desktop-Frames, Dunkel, Mobil, Bottom-Sheet, Tablet
- [x] A3 Datensätze (Liste, Detail), B3 Python-Lektion, B4 Sandbox
- [x] C1–C5 Konto: Login (+Fehler, mobil über QR), Registrieren (Schüler/Lehrkraft/mobil), Passwort vergessen, Beitreten (5 Zustände, Handy), Profil
- [x] D1–D6 Lehrerbereich: Klassen (+leer), Dashboard (Fokus, Matrix, leer, dunkel, Seitenpanel), Lektionen, Neue Klasse + QR-Vollbild, Schüler + Passwort-Reset, Einstellungen + Dialoge
- [x] D7 Quiz wählen, D8 Fragensatz-Editor, Auswertung
- [x] E1–E5 Quiz: Beamer + Handy, inkl. Verbindung unterbrochen, Pausiert
- [x] A5 Textseite, F 404 / 500 / Offline

## Erledigt in Review 3

- [x] Lehrerbereich Tablet + Handy (D1, D3, Detail)
- [x] A3 Datensätze mobil
- [x] Startseite mobil + Tablet
- [x] Navigation vereinheitlicht (Lernen · Datensätze · Für Lehrkräfte · Anmelden)
- [x] Avatar-Menü offen + Toast (A2-04)

## Noch offen

- [ ] **Domain uneinheitlich:** `kontakt@sbsqltt.de`, `sbsqltt.de/join` und `sbsqltt.jmestudio.de/join` gemischt. Mit neuem Namen Tabula: Ziel-Domain festlegen
- [ ] Favicon / Logo-Wortmarke „Tabula“ final (Repo, Meta-Tags, llms.txt, README umbenennen)

## Zu klären (Muri)

- [ ] A4 „Für Lehrkräfte“: eigene Seite oder Abschnitt auf Startseite reicht? (aktuell nur Abschnitt)

### Eule ↔ Zustand

| Zustand | Eule |
|---|---|
| Lädt | `loading` |
| Übung neu | `idle` |
| SQL-Fehler | `error` |
| Falsch | `thinking` |
| Tipp verfügbar / offen | `raisehand` / `hint` |
| Richtig | `success` |
| Lektion fertig | `celebrate` |
| Track fertig | `graduate` |
| Leer | `curious` / `point` |
| Quiz / Ende | `quiz` / `trophy` |
| Login | `wave` |
| 404 | `surprised` |
| Offline / DB lädt nicht | `sleep` |
| Python | `laptop` |
