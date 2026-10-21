# Design-Status (Stand v11, 2026-10-21)

Abgleich der Designer-Lieferung (`Website v11`, Design-System v3, Eule) mit [`DESIGN-SPEC.md`](./DESIGN-SPEC.md).

## Fertig

- [x] Design-System v3: Farben, Typo (IBM Plex), Radien, Schatten, Buttons, Badges, Tabs, Code, Hell/Dunkel (`sbsqltt-theme.css`)
- [x] Eule: 23 Posen + 24 Animationen als SVG (hell/dunkel), Icon in 5 Größen
- [x] **A1 Startseite** (v11), inkl. Für-Lehrkräfte-, Datenschutz-, Kosten- und FAQ-Abschnitt

## Noch zu designen

**Must (Demo)**
- [ ] A2 Lektionsübersicht (Fokus-Banner, gesperrte Lektion, Erstbesuch vs. „Weiter mit …“)
- [ ] B2 Lektion als **eigene Seite** mit allen Übungszuständen (Neu, Läuft, SQL-Fehler, Falsch, Richtig, Hängt fest, Lösung zeigen) + Abschluss-Screen + Mobil
- [ ] A3 Datensätze (Liste + Detail mit Schema, Vorschau, Download, Python-Snippet)
- [ ] C1 Login, C2 Registrieren (Schüler/Lehrkraft), C3 Klasse beitreten (QR-Flow, Handy)
- [ ] D1 Klassenübersicht (inkl. leer), D3 Klassen-Dashboard (Fokus, Liste, Seitenpanel, Matrix, leer), D4 Lektionen

**Should**
- [ ] E1–E5 Live-Quiz, je Beamer (16:9) **und** Handy
- [ ] D7 Quiz wählen, D2 Neue Klasse (+ QR-Vollbild), B3 Python-Lektion, B4 Sandbox

**Could**
- [ ] D8 Fragensatz-Editor, D5 Schüler, D6 Einstellungen, C4 Profil, C5 Passwort vergessen, F 404/500/Offline

## Zu klären

- [ ] Eule: welche Pose für welchen Zustand? (Vorschlag unten)
- [ ] A4 „Für Lehrkräfte“: eigene Seite oder reicht der Abschnitt auf der Startseite?
- [ ] Kontaktadresse `kontakt@sbsqltt.de`: Domain vorhanden? (aktuell `sbsqltt.jmestudio.de`)
- [ ] Animationen: `prefers-reduced-motion` beachten (Eule still stellen)

### Vorschlag: Eule ↔ Zustand

| Zustand | Eule |
|---|---|
| Lädt | `loading` |
| Übung neu / wartet | `idle` |
| SQL-Fehler | `error` |
| Falsch, aber läuft | `thinking` |
| Tipp | `hint` |
| Richtig | `success` |
| Lektion fertig | `celebrate` |
| Track fertig | `levelup` / `graduate` |
| Leerer Zustand | `curious` / `point` |
| Hängt fest (Lehrer-Sicht) | `raisehand` |
| Quiz | `quiz`, Ende `trophy` |
| Willkommen / Login | `wave` |
| 404 | `surprised` |
| Offline | `sleep` |
| Python-Lektion | `laptop` / `typing` |
