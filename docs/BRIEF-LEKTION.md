# Briefing: Lektionsseite (B2)

Stand: 2026-10-21 · Für: Designer · Basis: [`DESIGN-SPEC.md`](./DESIGN-SPEC.md) Abschnitt B2, Design-System v3, Startseite v11

Die Lektionsseite ist das **Herzstück**. Hier verbringen Schüler 90 % ihrer Zeit.
Ausgangspunkt ist das **„Dein SQL Studio“-Modul aus v11**. Es wird zur eigenen, vollflächigen Seite ausgebaut.

---

## 1. Ziel

Ein Schüler versteht ein SQL-Konzept, probiert es aus und löst eine Aufgabe, **ohne dass ihn die Oberfläche ablenkt**.
- Eine Hauptaktion zur Zeit: erst **Ausführen**, nach richtiger Lösung **Weiter**.
- Die Eule hilft, verrät aber keine Lösung (siehe v11 „Hilft beim Denken. Verrät keine Lösungen.“).

## 2. Layout Desktop (ab 1280 px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Lektionen   Lektion 3 · Mit WHERE filtern   ●●●○○ Schritt 3/5   ⬇ DB  👤 │  Kopfleiste (schlank)
├────────────┬─────────────────────────────────────────────────────────────┤
│ SCHRITTE   │ AUFGABE                                                     │
│ ✓ Warum    │ Welche Bücher sind nach 2010 erschienen?                    │
│ ✓ Aufbau   │ Zeige Titel und Jahr. Sortiere die ältesten zuerst.         │
│ ● Übung    ├───────────────┬─────────────────────────────────────────────┤
│ ○ Kombin.  │ SCHEMA        │ EDITOR  query.sql                           │
│ ○ Fazit    │ ▸ books       │ 1 SELECT title, year                        │
│            │   id     int  │ 2 FROM books                                │
│            │   title  text │ 3 WHERE                                     │
│            │   year   int  │                                             │
│            │ ▸ publishers  │ [▶ Ausführen]  Zurücksetzen   Strg/⌘+Enter  │
│            │               ├─────────────────────────────────────────────┤
│            │               │ ERGEBNIS                       3 Zeilen     │
│            │               │ title                  │ year               │
│            │               │ …                                           │
├────────────┴───────────────┴─────────────────────────────────────────────┤
│ 🦉 Status/Feedback-Leiste                       [← Zurück]  [Weiter →]   │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Linke Leiste (Schritte):** schmal, einklappbar. Zeigt die Schritte der Lektion (fertig / aktuell / offen). Wie in v11 „SQL-Grundlagen“, aber Schritte statt Lektionen.
- **Aufgabe:** immer oben sichtbar, max. 3 Zeilen.
- **Schema:** Tabellen aufklappbar, Spalte + Typ. Klick auf einen Namen fügt ihn in den Editor ein. Primär-/Fremdschlüssel markiert (🔑).
- **Editor:** dunkle Fläche wie in v11, Zeilennummern, Syntaxfarben aus dem Design-System.
- **Ergebnis:** Tabelle, sticky Kopfzeile, Zeilenanzahl rechts oben, scrollt innerhalb.
- **Feedback-Leiste unten:** Eule (klein, ca. 40 px) + Nachricht + Aktionen. **Hier landet jedes Feedback**, an einem festen Ort.

## 3. Schritt-Typen

| Typ | Inhalt | Aussehen |
|---|---|---|
| **Erklärung** | Fließtext (max. ~150 Wörter), Codebeispiel | Lesespalte (max. ~680 px), **kein** Editor. Codebeispiel mit Button „Ausprobieren“ → wechselt in Übungslayout mit vorausgefülltem Code |
| **Beispiel** | Abfrage + Ergebnis | Editor + Ergebnis, Abfrage ist schon da, nur Ausführen. Keine Prüfung |
| **Übung** | Aufgabe | volles Layout wie oben, mit Prüfung |
| **Zusammenfassung** | 3–5 Kernpunkte, Box „Wozu braucht man das in echt?“ | Lesespalte, Eule `read`, Button „Lektion abschließen“ |

## 4. Zustände der Übung (alle bitte als eigenes Frame)

| # | Zustand | Feedback-Leiste | Eule | Farbe (DS v3) | Hauptbutton |
|---|---|---|---|---|---|
| 1 | **Neu** | „Schreib deine Abfrage und führe sie aus.“ | `idle` | neutral | Ausführen |
| 2 | **Läuft** | Spinner im Ergebnisbereich (nur falls > 300 ms) | `loading` | neutral | Ausführen (inaktiv) |
| 3 | **SQL-Fehler** | Verständliche Meldung, z. B. „Nach JOIN fehlt die Bedingung mit ON.“ + Originalfehler klein/aufklappbar. Betroffene Zeile im Editor rot markiert | `error` | `danger` | Ausführen |
| 4 | **Falsch** | „Noch nicht ganz.“ + konkreter Unterschied („3 Zeilen zu viel“, „Spalte *year* fehlt“). Ergebnis bleibt sichtbar | `thinking` | `accent-soft` (kein Rot!) | Ausführen |
| 5 | **Tipp verfügbar** | ab 3. Fehlversuch: Button „Tipp anzeigen“ erscheint | `raisehand` | `accent-soft` | Ausführen |
| 6 | **Tipp offen** | Tipp-Karte (wie v11 „Ein Hinweis zur richtigen Zeit“), danach Link „Lösung zeigen“ | `hint` | `accent-soft` | Ausführen |
| 7 | **Lösung gezeigt** | Rückfrage-Dialog vorher. Danach Lösung im Editor, Hinweis „Lösung angezeigt“ | `point` | neutral | Weiter |
| 8 | **Richtig** | „Richtig! Genau die Bücher nach 2010.“ kurze Bestätigung | `success` (einmal animiert) | `ok` | **Weiter** |

Regeln:
- **Falsch ist nicht Fehler.** Falsche Ergebnisse sind blau/neutral, nur echte SQL-Fehler sind rot.
- Eule animiert nur bei **Richtig** und **Lektion fertig** (v11: „Würdigt Fortschritt, nicht nach jedem Klick“).
- `prefers-reduced-motion`: keine Animation, statische Pose.

## 5. Weitere Frames

- **Lektion abgeschlossen:** Vollfläche oder Modal. Eule `celebrate`, Titel „Lektion geschafft“, 3 Kernpunkte, Buttons **„Nächste Lektion“** (Haupt) + „Zur Übersicht“. Track fertig → Eule `graduate`.
- **Gast-Hinweis:** nach erster gelöster Übung dezent in der Feedback-Leiste: „Melde dich an, um deinen Fortschritt zu sichern.“ (schließbar)
- **DB lädt nicht:** Eule `sleep`, „Datenbank konnte nicht geladen werden“ + „Erneut versuchen“.
- **Zurücksetzen-Dialog:** „Deine Abfrage wird durch den Startcode ersetzt.“ Abbrechen / Zurücksetzen.
- **DB-Download:** Icon-Button in der Kopfleiste, Tooltip „Datenbank herunterladen (.db), z. B. für Python“.
- **Lange Ergebnisse:** > 100 Zeilen, Hinweis „Erste 100 von 1.240 Zeilen“.
- **Breite Ergebnisse:** horizontales Scrollen, erste Spalte sticky.

## 6. Mobil (360–767 px)

Untereinander, eine Sache pro Bildschirmhöhe:
1. Kopfleiste: ← · Schritt 3/5 · ⋯ (Menü mit DB-Download, Schritte)
2. Aufgabe (einklappbar nach erstem Ausführen)
3. Button „Schema“ → Bottom-Sheet
4. Editor (min. 6 Zeilen hoch)
5. Ergebnis
6. **Sticky unten:** Feedback + Hauptbutton (Ausführen / Weiter)

Tablet (768–1279 px): Schritt-Leiste ausgeblendet (über Kopfleiste erreichbar), Schema als einklappbare Spalte.

## 7. Tastatur & Barrierefreiheit

- Strg/⌘ + Enter = Ausführen · Alt + → = Weiter (wenn aktiv)
- Fokus-Ring sichtbar, Feedback-Leiste als `aria-live`
- Zustände nie nur über Farbe: immer Icon + Text

## 8. Lieferumfang (Frames)

| Frame | Desktop | Mobil |
|---|---|---|
| Erklärung | ✓ | ✓ |
| Beispiel | ✓ | |
| Übung: Zustände 1–8 | ✓ (alle 8) | ✓ (1, 3, 4, 6, 8) |
| Zusammenfassung | ✓ | ✓ |
| Lektion geschafft | ✓ | ✓ |
| DB lädt nicht, Zurücksetzen-Dialog, Lösung-Dialog | ✓ | |
| Dunkel-Variante | Übung Zustand 1, 3, 8 | |

Beispielinhalt für alle Frames: Lektion 3 „Mit WHERE filtern“, Datensatz `books` + `publishers` (wie v11).
