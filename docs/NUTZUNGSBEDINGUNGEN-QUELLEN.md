# Nutzungsbedingungen: Quellen und Prüfprotokoll

Stand: 30.10.2026. Grundlage für `src/lib/tabula/terms.ts` und `/nutzungsbedingungen`.
Jeder Absatz trägt im Code Quellen-IDs (`src`). Auf der Website werden die Quellen nicht angezeigt, nur hier.

**Status: Entwurf zur anwaltlichen Prüfung** (siehe `docs/ANWALT-FRAGEN.md`, Frage 10). Die Seite ist online, damit der Text
im echten Layout gelesen werden kann. Offline nehmen: in `src/lib/tabula/terms.ts` `LIVE = false` setzen, bauen, deployen.
Dann liefert `/nutzungsbedingungen` 404, und alle Links (Fußzeilen, Registrierung, Beitritt) verschwinden, weil sie dieselbe
Konstante lesen. Der Server verlangt bei der Registrierung weiter `terms_accepted: true` (Feld gab es schon für den
Datenschutz-Haken), es gibt also keine Server-Änderung beim Ein- oder Ausschalten.

Methode wie bei der Datenschutzerklärung (`docs/DATENSCHUTZ-QUELLEN.md`): Jede Aussage über Tabula ist am Quellcode oder
am Server geprüft (T), jede rechtliche Aussage an der Norm im Wortlaut (R), Behördenpapiere im Original (A).
Gesetzestexte am 30.10.2026 von gesetze-im-internet.de abgerufen, DSA im Wortlaut von EUR-Lex (CELEX 32022R2065).

## Grundentscheidungen (mit Begründung)

1. **Warum überhaupt Bedingungen?** Für einen kostenlosen Dienst gibt es keine allgemeine Pflicht zu AGB. Sie sind aber
   sinnvoll für Haftung, Regeln für Lehrkräfte, Melde-Weg für rechtswidrige Inhalte (DSA) und das Ende der Nutzung.
   Tabula ist ein **Hostingdienst** im Sinne von Art. 3 lit. g Ziff. iii DSA, weil Fragensätze und Klassennamen
   im Auftrag von Lehrkräften gespeichert werden (R12). Damit gelten Art. 11, 12, 14 und 16 DSA auch für sehr kleine
   Anbieter. Ausgenommen sind Kleinst- und Kleinunternehmen nur von Art. 15 (Transparenzberichte, Art. 15 Abs. 2) und vom
   Abschnitt über Online-Plattformen (Art. 19). Tabula ist keine Online-Plattform, weil nichts öffentlich verbreitet wird
   (Art. 3 lit. i: „speichert und öffentlich verbreitet“). Wortlaut geprüft am 30.10.2026.
2. **Einbeziehung (R2):** § 305 Abs. 2 BGB verlangt Hinweis, zumutbare Kenntnisnahme und Einverständnis bei
   Vertragsschluss. Umsetzung: Haken bei der Registrierung mit Link (öffnet in neuem Tab), Hinweis beim Klassenbeitritt.
   Eine Checkbox ist nach herrschender Meinung nicht zwingend, erleichtert aber den Nachweis. Server speichert
   `terms_accepted_at` (T4).
3. **Haftung (R4, R5, R16 bis R18):** Unentgeltliche Leistungen haften kraft Gesetzes nur für Vorsatz und grobe
   Fahrlässigkeit (§ 521 BGB Schenkung, § 599 BGB Leihe). Ob ein kostenloser Onlinedienst Schenkung, Leihe oder Vertrag
   eigener Art ist, ist nicht abschließend geklärt; deshalb ist die Beschränkung zusätzlich als Klausel formuliert.
   Die Klausel bleibt innerhalb von § 309 Nr. 7 BGB: kein Ausschluss für Leben, Körper, Gesundheit und grobes Verschulden.
   Ausdrücklich unberührt: ProdHaftG (§ 14 nicht abdingbar) und Arglist (§§ 523, 524 BGB).
   **Offene Frage an den Anwalt:** Reicht der Ausschluss leichter Fahrlässigkeit insgesamt, oder muss er für
   „wesentliche Vertragspflichten“ (Kardinalpflichten, Rechtsprechung zu § 307 Abs. 2 Nr. 2 BGB) eingeschränkt werden?
   Bei unentgeltlichen Diensten spricht die gesetzliche Wertung (§§ 521, 599) für die Wirksamkeit.
4. **Änderungen (R20, R13):** Keine Zustimmungsfiktion. Der BGH hat am 27.04.2021 (XI ZR 26/20) Klauseln für unwirksam
   erklärt, die die Zustimmung zu AGB-Änderungen ohne inhaltliche Einschränkung aus Schweigen ableiten. Deshalb:
   wesentliche Änderungen nur mit ausdrücklicher Zustimmung, Information vorher (auch Art. 14 Abs. 2 DSA).
5. **Einstellen und Kündigung (R6, R19):** Einseitige Änderungs- und Einstellungsvorbehalte müssen nach § 307 BGB einen
   Grund und Vorlauf haben. Gewählt: vier Wochen Vorlauf per E-Mail. Fristlose Sperre nur bei schwerem Verstoß, mit
   vorheriger Gelegenheit zur Abhilfe (Gedanke des § 314 Abs. 2 BGB).
6. **Schule als Verantwortliche (A1, R8, R9):** Die DSK-Orientierungshilfe für Online-Lernplattformen (Stand
   26.04.2018) sieht Schule bzw. Schulaufsicht als Verantwortliche; Lehrkräfte dürfen Plattformen nur einsetzen, soweit
   die Schule über den Einsatz entschieden hat. Die Bedingungen weisen darauf hin und bieten den AV-Vertrag an.
   Deckt sich mit `docs/BACKEND-DATENSCHUTZ.md` K12 und der Datenschutzerklärung.
7. **Verbraucherschlichtung (R23):** § 36 VSBG verpflichtet zur Angabe erst ab mehr als zehn Beschäftigten (§ 36
   Abs. 3). Freiwilliger Hinweis, dass wir nicht teilnehmen, ist unschädlich und schafft Klarheit.
8. **Rechtswahl (R21):** Deutsches Recht mit dem Vorbehalt aus Art. 6 Abs. 2 Rom I (zwingender Verbraucherschutz am
   Aufenthaltsort bleibt). Eine Rechtswahl ohne diesen Hinweis gilt nach EuGH-Rechtsprechung (C-191/15, Amazon) als
   intransparent. Kein Gerichtsstand gegenüber Verbrauchern.
9. **Schüler (T5, P3):** Schüler haben kein Konto mit E-Mail. Viele sind minderjährig. Der Beitritt erfolgt im Rahmen
   des Unterrichts auf Veranlassung der Lehrkraft. Ob für Minderjährige ein eigener Vertrag zustande kommt (§§ 104 ff.
   BGB, Zustimmung der Eltern bzw. Schule), ist **offene Frage an den Anwalt**. Der Text ist so formuliert, dass er für
   Schüler nur Verhaltensregeln enthält und keine Pflichten mit Kostenfolge.

## Rechtsquellen (R)

| ID | Norm | Wortlaut geprüft | Verwendet für |
|---|---|---|---|
| R1 | § 305 Abs. 1 BGB | ja, 30.10.2026 | Begriff AGB, Geltungsbereich |
| R2 | § 305 Abs. 2 BGB | ja | Einbeziehung bei Registrierung und Beitritt |
| R3 | Art. 13 DSGVO | aus Datenschutz-Recherche | Datenschutzerklärung getrennt von den Bedingungen |
| R4 | §§ 516 ff., 598 BGB | § 598 ja | unentgeltliche Bereitstellung |
| R5 | § 521, § 599 BGB | ja („nur Vorsatz und grobe Fahrlässigkeit“) | Haftungsmaßstab |
| R6 | § 307 Abs. 1, 2 BGB | ja (Transparenzgebot, unangemessene Benachteiligung) | Änderungs-/Einstellungsvorbehalt mit Vorlauf |
| R7 | § 241 Abs. 2 BGB | Inhalt bekannt (Rücksichtnahmepflichten) | Pflichten der Nutzer, Zugangsdaten |
| R8 | Art. 4 Nr. 7 DSGVO | aus Datenschutz-Recherche | Schule als Verantwortliche |
| R9 | Art. 28 DSGVO | aus Datenschutz-Recherche | AV-Vertrag mit Schulen |
| R10 | §§ 202a, 303b StGB | Inhalt bekannt | Verbot, Schutzmaßnahmen zu umgehen |
| R11 | § 31 UrhG | Inhalt bekannt (Zweckübertragung) | eng begrenzte Nutzungserlaubnis an eigenen Inhalten |
| R12 | Art. 3 lit. g iii, Art. 6 DSA | ja, EUR-Lex | Einordnung als Hostingdienst |
| R13 | Art. 14 Abs. 1, 2 DSA | ja | Angaben zur Moderation, Info über wesentliche Änderungen |
| R14 | Art. 16, 17 DSA | Art. 16 ja | Meldeweg, Begründung an Betroffene |
| R15 | Art. 11, 12 DSA | ja | zentrale Kontaktstelle, Sprachen |
| R16 | § 309 Nr. 7 lit. a, b BGB | ja | Grenzen des Haftungsausschlusses |
| R17 | § 14 ProdHaftG | Inhalt bekannt | ProdHaftG unberührt |
| R18 | §§ 523, 524 BGB | Inhalt bekannt | Arglist unberührt |
| R19 | § 314 BGB | ja | Kündigung aus wichtigem Grund, Abmahnung |
| R20 | BGH XI ZR 26/20 | Urteil vom 27.04.2021, Pressemitteilung Nr. 088/2021 | keine Zustimmungsfiktion |
| R21 | Art. 6 Abs. 2 Rom I | Inhalt bekannt | Rechtswahl mit Verbrauchervorbehalt |
| R22 | § 306 Abs. 1, 2 BGB | ja | Teilunwirksamkeit, gesetzliche Regelung tritt ein |
| R23 | § 36 VSBG | Inhalt bekannt | Hinweis zur Streitbeilegung |

## Behörden- und Anbieterdokumente (A)

| ID | Dokument | Aussage |
|---|---|---|
| A1 | DSK, Orientierungshilfe Online-Lernplattformen im Schulunterricht (26.04.2018), datenschutzkonferenz-online.de | Lehrkräfte setzen Plattformen nur ein, soweit Schule/Schulaufsicht entschieden hat; Schule bleibt „Herrin der Daten“; Auftragsverarbeitung nach Art. 28 |
| A2 | GNU AGPL v3, gnu.org | Lizenz des Quellcodes einschließlich Lektionen und Datensätze |

## Verweise auf die Datenschutzerklärung (P)

| ID | Stelle in `privacy.ts` / `docs/BACKEND-DATENSCHUTZ.md` |
|---|---|
| P1 | Verantwortlicher, Kontakt |
| P2 | kein Tracking, keine Werbung, kein Verkauf |
| P3 | K1: Schüler ohne Konto, Klassen-Login, Name nur für die Lehrkraft lesbar |
| P4 | K12: Schule als Verantwortliche, AV-Vertrag |
| P5 | K8: Löschung nach 12 Monaten, Erinnerung 30 Tage vorher |

## Technische Prüfung (T)

| ID | Aussage | Prüfung | Ergebnis |
|---|---|---|---|
| T1 | kostenlos, keine Bezahlstufen | README, Startseite, `grep -ri "stripe\|paypal\|price" src server/src` | keine Zahlungsfunktion |
| T2 | Lernen ohne Anmeldung, Fortschritt nur im Browser | `lessons.ts` (localStorage), Abnahme `app-e2e.mjs` A1 bis A7 | bestätigt |
| T3 | Funktionsumfang | `src/routes` (learn, teach, quiz, datasets) | bestätigt |
| T4 | Registrierung, `terms_accepted`, Wiederherstellungscode | `server/src/routes/auth.ts` Z. 51 `terms_accepted: z.literal(true)`, `terms_accepted_at` in users | bestätigt |
| T5 | Schüler ohne E-Mail, Beitritt mit Klassencode | `server/src/routes/class-login.ts` | bestätigt |
| T6 | Schülernamen ohne Code nicht wiederherstellbar, kommen bei nächster Anmeldung zurück | `keystore.ts`, `needs_key_recovery`, Rekey beim Schüler-Login | bestätigt |
| T7 | Eigene Inhalte nur Fragensätze und Klassennamen, nur Lehrkraft und eigene Klasse sehen sie, keine Vorabprüfung | `quiz.ts` (teacher_id-Prüfung), `quiz-ws.ts` (Mitgliedschaft der Klasse) | bestätigt |
| T8 | Begrenzung von Fehlversuchen | `class-login.ts` (40/15 min je Gerät, 300 je Klasse), `quiz-ws.ts` (10/min) | bestätigt |
| T9 | Kontakt für Sicherheitsmeldungen | Impressum | kontakt@tabulasql.de |
| T10 | AGPL-3.0, GitHub | `LICENSE` | GNU AGPL v3 |
| T11 | Datensätze erfunden | `course/data.ts`, `traffic-data.ts` | **Einschränkung:** die Bibliothek nennt echte Fachbücher mit echten Autoren (z. B. „Clean Code“, Robert C. Martin) neben erfundenen Titeln. Personen in Ausleihen und alle Messwerte sind erfunden. Der Text trennt deshalb: Personen, Kunden und Messwerte erfunden, einige Buchtitel und Autoren echt, Preise, Seitenzahlen und Bestände nur Übungswerte. **Formulierung mit Anwalt prüfen** (Nennung echter Autoren in Übungsdaten) |
| T12 | keine Noten, Punkte nur im Quiz | Startseite, Quiz | bestätigt |
| T13 | tägliche Sicherung | `deploy/tabula-backup.timer` OnCalendar 03:15, auf dem Server `active`, letzte Datei `tabula-2026-10-30.db.age` | bestätigt |
| T14 | Konto löschen löscht Klassen, Schüler, Fortschritt, **Fragensätze**; Schüler verlassen Klasse | `auth.ts` DELETE /me, `class-login.ts` POST /student/leave | **Bei der Prüfung Fehler gefunden und behoben:** Fragensätze blieben nach dem Löschen ohne Besitzer zurück (`quiz_question_sets.teacher_id ON DELETE SET NULL`). Jetzt `deleteTeacherQuizzes()` in `server/src/db.ts`, aufgerufen in DELETE /me und im Inaktivitätsjob. Tests: `haertung.test.ts` „löscht auch eigene Fragensätze“, `jobs.test.ts` K8. Auf dem Server 2 verwaiste automatische Fragensätze (ohne Personenbezug) nach Sicherung entfernt |
| T15 | 12 Monate, Erinnerung 30 Tage vorher nur an Lehrkräfte | `server/src/jobs.ts` INACTIVITY_LIMIT_S, REMINDER_WINDOW_S, `role = 'teacher'` | bestätigt |

## Offene Fragen an den Anwalt (Ergänzung zu ANWALT-FRAGEN.md Frage 10)

1. Haftungsklausel ohne Kardinalpflichten-Vorbehalt bei unentgeltlichem Dienst ausreichend? (Grundentscheidung 3)
2. Kommt mit minderjährigen Schülern ein Vertrag zustande, und braucht es dafür etwas (Eltern, Schule)? (9)
3. Ist der Hinweis beim Klassenbeitritt (ohne Haken) für Schüler ausreichend? (2)
4. Formulierung zu den Datensätzen mit echten Buchtiteln und Autoren (T11).
5. Reichen vier Wochen Vorlauf beim Einstellen des Dienstes? (5)
6. Müssen Bestandskonten (vor dem 30.10.2026 registriert) den Bedingungen noch zustimmen? Aktuell haben sie nur den
   Datenschutz-Haken gesetzt. Vorschlag: Zustimmung bei der nächsten Anmeldung einholen, falls der Anwalt das für
   nötig hält (R2, R20).
