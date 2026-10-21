# Design-Status (Stand Review 2, 2026-10-21)

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

## Noch offen (klein)

- [ ] **Lehrerbereich mobil/Tablet** (mind. D1 + D3; Lehrkräfte schauen im Unterricht oft aufs Tablet)
- [ ] **A3 Datensätze mobil**
- [ ] **Startseite mobil** (v11 als 390-px-Frame)
- [ ] **Navigation vereinheitlichen:** Startseite hat „Für Lehrkräfte · Lernpfad · Datenschutz · FAQ“, App hat „Lernen · Datensätze · Für Lehrkräfte“. Ein Header für beide oder bewusst zwei?
- [ ] Avatar-Menü offen (Schüler / Lehrkraft) als Frame
- [ ] Toast-Beispiel im Kontext (z. B. D4 „Gespeichert“)

## Zu klären (Muri)

- [ ] Domain: QR zeigt `sbsqltt.jmestudio.de/join`, Kontakt ist `kontakt@sbsqltt.de`. Eine Domain festlegen.
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
