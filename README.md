# SbSQLTT

> **Pre-MVP.** Modern, free, open-source SQL trainer for the web. Practice
> queries against pre-built schemas, or design your own — all in your browser,
> no signup required.

Inspired by [sqlbolt.com](https://sqlbolt.com), but built in 2026: Postgres in
the browser (via PGlite WASM), markdown-authored lessons, optional cloud
sign-in to save progress, and a teacher view for classrooms.

## Status

🚧 **Pre-MVP — expect breaking changes.** Repository is public from day one for
transparency; `main` is intended to stay green, active work happens on feature
branches.

## Planned phases

| Phase | Goal |
|---|---|
| **P1 — Learner MVP** | Anonymous learner can finish a SQL lesson on their phone |
| **P2 — DB-design mode** | Learners can build their own schemas and query them |
| **P3 — Teacher dashboard** | Classroom view: per-student progress, "stuck on" indicator |
| **P4 — Community** | Lesson contributions, self-host docs |

## Stack

- **Frontend:** SvelteKit + Tailwind CSS + shadcn-svelte
- **SQL sandbox:** [PGlite](https://github.com/electric-sql/pglite) (Postgres in WASM)
- **Editor:** CodeMirror 6 with Postgres dialect
- **Backend:** SvelteKit server endpoints
- **DB + Auth:** Supabase (EU region, Free tier)
- **Hosting:** Vercel Free + custom domain at `sbsqltt.jmestudio.de`

## Local development

```bash
npm install
npm run dev
```

## License

[AGPL-3.0](LICENSE) — free for everyone, including schools. Forks that run
SbSQLTT as a network service must publish their modifications. No SaaS-hijack.

## Contact

Building this solo. If you teach SQL and want to use SbSQLTT in your classroom,
reach out: [murat.meric@jmestudio.de](mailto:murat.meric@jmestudio.de).
