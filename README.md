# SbSQLTT

🇩🇪 [Deutsch](#deutsch) · 🇬🇧 [English](#english)

---

<a id="deutsch"></a>

## Deutsch

> **Pre-MVP.** Moderner, kostenloser, quelloffener SQL-Trainer fürs Web. Übe
> Abfragen gegen vorgefertigte Schemata oder entwirf dein eigenes, direkt im
> Browser, ohne Anmeldung.

Inspiriert von [sqlbolt.com](https://sqlbolt.com), aber in 2026 gebaut:
Postgres im Browser (via PGlite WASM), Lektionen in Markdown verfasst,
optionales Cloud-Login zum Speichern des Fortschritts und ein Lehrer-Dashboard
fürs Klassenzimmer.

### Status

🚧 **Pre-MVP, Breaking Changes erwartet.** Das Repository ist von Tag 1 an
öffentlich für volle Transparenz. `main` bleibt grün, aktive Arbeit passiert in
Feature-Branches.

### Geplante Phasen

| Phase | Ziel |
|---|---|
| **P1 — Lerner-MVP** | Anonyme Nutzer schließen eine SQL-Lektion auf dem Smartphone ab |
| **P2 — DB-Design** | Nutzer entwerfen eigene Schemata und fragen sie ab |
| **P3 — Lehrer-Dashboard** | Klassenraum-Sicht mit Schüler-Fortschritt und "hängt fest"-Anzeige |
| **P4 — Community** | Lektions-Beiträge, Self-Hosting-Doku |

### Stack

- **Frontend:** SvelteKit + Tailwind CSS + shadcn-svelte
- **SQL-Sandbox:** [PGlite](https://github.com/electric-sql/pglite) (Postgres in WASM)
- **Editor:** CodeMirror 6 mit Postgres-Dialekt
- **Backend:** SvelteKit-Server-Endpoints
- **DB + Auth:** Supabase (EU-Region, Free Tier)
- **Hosting:** Vercel Free + eigene Domain unter `sbsqltt.jmestudio.de`

### Lokale Entwicklung

```bash
npm install
npm run dev
```

### Lizenz

[AGPL-3.0](LICENSE), kostenlos für alle, inklusive Schulen. Forks, die SbSQLTT
als Netzwerkdienst betreiben, müssen ihre Änderungen veröffentlichen. Kein
SaaS-Hijack möglich.

### Kontakt

Solo-Projekt. Wenn Sie SQL unterrichten und SbSQLTT im Unterricht einsetzen
möchten, schreiben Sie kurz an
[murat.meric@jmestudio.de](mailto:murat.meric@jmestudio.de).

---

<a id="english"></a>

## English

> **Pre-MVP.** Modern, free, open-source SQL trainer for the web. Practice
> queries against pre-built schemas, or design your own, all in your browser,
> no signup required.

Inspired by [sqlbolt.com](https://sqlbolt.com), but built in 2026: Postgres in
the browser (via PGlite WASM), markdown-authored lessons, optional cloud
sign-in to save progress, and a teacher view for classrooms.

### Status

🚧 **Pre-MVP, expect breaking changes.** Repository is public from day one for
transparency; `main` is intended to stay green, active work happens on feature
branches.

### Planned phases

| Phase | Goal |
|---|---|
| **P1 — Learner MVP** | Anonymous learner can finish a SQL lesson on their phone |
| **P2 — DB-design mode** | Learners can build their own schemas and query them |
| **P3 — Teacher dashboard** | Classroom view: per-student progress, "stuck on" indicator |
| **P4 — Community** | Lesson contributions, self-host docs |

### Stack

- **Frontend:** SvelteKit + Tailwind CSS + shadcn-svelte
- **SQL sandbox:** [PGlite](https://github.com/electric-sql/pglite) (Postgres in WASM)
- **Editor:** CodeMirror 6 with Postgres dialect
- **Backend:** SvelteKit server endpoints
- **DB + Auth:** Supabase (EU region, Free tier)
- **Hosting:** Vercel Free + custom domain at `sbsqltt.jmestudio.de`

### Local development

```bash
npm install
npm run dev
```

### License

[AGPL-3.0](LICENSE), free for everyone, including schools. Forks that run
SbSQLTT as a network service must publish their modifications. No SaaS-hijack.

### Contact

Building this solo. If you teach SQL and want to use SbSQLTT in your classroom,
reach out: [murat.meric@jmestudio.de](mailto:murat.meric@jmestudio.de).
