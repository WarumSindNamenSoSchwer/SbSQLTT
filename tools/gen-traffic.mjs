#!/usr/bin/env node
// tools/gen-traffic.mjs
// Deterministischer Generator fuer den App-Traffic-Datensatz.
// Ergebnis wird nach src/lib/tabula/course/traffic-data.ts geschrieben.
// Fester Seed, kein Math.random ohne Seed.
//
// Geschichte:
//   - 6 Wochen stündlich (1008 Zeilen)
//   - Tagesrhythmus: nachts (0-6h) wenig, abends (19-22h) Spitze
//   - Wochenende: flachere Kurve, 70 % Wochentag-Peak
//   - Stetiges Nutzerwachstum (~+18 % über 6 Wochen)
//   - Ab v2.4 (Woche 4, Montag): avg_ms steigt deutlich bei gleicher Last
//   - Fehlerrate steigt, wenn users nahe max_users (Auslastung > 85 %)
//   - Server 1: eu-west, max_users 220;  Server 2: eu-central, max_users 180
//   - Releases: v2.2, v2.3, v2.4 (der problematische), v2.4.1 (teilfixes)

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- Seeded PRNG (mulberry32) --------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xdeadbeef);

// ---- Hilfsfunktionen -------------------------------------------------------
function padTwo(n) {
  return String(n).padStart(2, '0');
}

function tsString(date) {
  const y = date.getUTCFullYear();
  const m = padTwo(date.getUTCMonth() + 1);
  const d = padTwo(date.getUTCDate());
  const h = padTwo(date.getUTCHours());
  return `${y}-${m}-${d} ${h}:00`;
}

function addHours(date, h) {
  const d = new Date(date);
  d.setTime(d.getTime() + h * 3600000);
  return d;
}

// ---- Parameter -------------------------------------------------------------
// Startdatum: Montag, 2026-01-05 00:00 UTC
const START = new Date('2026-01-05T00:00:00Z');
const WEEKS = 6;
const TOTAL_HOURS = WEEKS * 7 * 24; // 1008

// Server
const SERVERS = [
  { id: 1, name: 'eu-west-1', region: 'eu-west', max_users: 70 },
  { id: 2, name: 'eu-central-1', region: 'eu-central', max_users: 55 }
];

// Releases
const RELEASES = [
  { id: 1, version: 'v2.2', released_at: tsString(addHours(START, 0)), note: 'Neue Startseite, Performance-Tuning' },
  { id: 2, version: 'v2.3', released_at: tsString(addHours(START, 7 * 24)), note: 'Benachrichtigungen, Bug-Fixes' },
  { id: 3, version: 'v2.4', released_at: tsString(addHours(START, 3 * 7 * 24)), note: 'Datenbankschema-Migration, neue API-Endpoints' },
  { id: 4, version: 'v2.4.1', released_at: tsString(addHours(START, 4 * 7 * 24 + 2 * 24)), note: 'Hotfix: Cache-Fehler nach Migration teilweise behoben' }
];

// Stunde des v2.4-Releases: Woche 4, Montag 00:00 = 3*7*24 = 504
const V24_HOUR = 3 * 7 * 24; // 504
// Hotfix-Stunde: v2.4.1
const V241_HOUR = 4 * 7 * 24 + 2 * 24; // 720

// ---- Stündliches Tagesprofil (Index = Stunde 0-23) -------------------------
// Normiert auf max ~1.0; wird mit base_users skaliert.
const DAY_PROFILE = [
  0.03, 0.02, 0.02, 0.02, 0.03, 0.05,  // 0-5: Nacht
  0.10, 0.22, 0.42, 0.58, 0.72, 0.80,  // 6-11: Morgen
  0.75, 0.70, 0.72, 0.74, 0.76, 0.82,  // 12-17: Mittag + Nachmittag
  0.90, 0.97, 1.00, 0.95, 0.80, 0.60   // 18-23: Abend (Peak 20 Uhr)
];

// Wochenendprofil: flacher (70 % des Wochentag-Peaks)
const WE_PROFILE = DAY_PROFILE.map((v) => v * 0.70);

// ---- Trafik-Generierung ----------------------------------------------------
const rows = []; // { ts, users, avg_ms, errors, server_id }

for (let h = 0; h < TOTAL_HOURS; h++) {
  const date = addHours(START, h);
  const hour = date.getUTCHours();
  const dow = date.getUTCDay(); // 0=So, 6=Sa
  const isWeekend = dow === 0 || dow === 6;
  const weekFraction = h / TOTAL_HOURS; // 0..1 (Wachstum)

  // Basis-Nutzerzahl wächst von 100 auf 118 (+18 % in 6 Wochen)
  const baseUsersGlobal = 100 * (1 + 0.18 * weekFraction);

  // Zwei Server teilen sich den Traffic (Server 1: 55 %, Server 2: 45 %)
  for (const srv of SERVERS) {
    const share = srv.id === 1 ? 0.55 : 0.45;
    const profile = isWeekend ? WE_PROFILE : DAY_PROFILE;
    const load = profile[hour];

    // Nutzerzahl für diesen Server
    const baseUsers = Math.round(baseUsersGlobal * share * load);
    // Etwas Rauschen (+/- 8 %)
    const noise = 1 + (rand() - 0.5) * 0.16;
    const users = Math.max(1, Math.round(baseUsers * noise));

    // Auslastung relativ zu max_users
    const util = users / srv.max_users; // 0..1+

    // avg_ms: Basis 80 ms, bei hoher Auslastung steigt es leicht
    let baseMs = 80 + util * 40;

    // Ab v2.4: avg_ms deutlich höher (Migration schleppt bei jeder Abfrage)
    if (h >= V24_HOUR && h < V241_HOUR) {
      baseMs = baseMs * 3.1 + 90; // Multiplikator + Fixkosten
    } else if (h >= V241_HOUR) {
      // Hotfix hat Cache-Problem nur teilweise behoben
      baseMs = baseMs * 1.85 + 40;
    }

    // Rauschen auf avg_ms
    const msNoise = 1 + (rand() - 0.5) * 0.20;
    const avg_ms = Math.max(30, Math.round(baseMs * msNoise));

    // Fehlerrate steigt, wenn util > 0.85
    let errorRate = 0;
    if (util > 0.85) {
      errorRate = Math.pow((util - 0.85) / 0.15, 2) * 0.12; // max 12 % bei 100 %
    }
    // v2.4 erhöht auch Fehlerrate durch Backend-Timeouts
    if (h >= V24_HOUR && h < V241_HOUR) {
      errorRate += 0.015 + (rand() * 0.025); // +1.5..4 % extra
    } else if (h >= V241_HOUR) {
      errorRate += 0.008 + (rand() * 0.012);
    }
    const errors = Math.round(users * errorRate * (1 + (rand() - 0.5) * 0.30));

    rows.push({ ts: tsString(date), users, avg_ms, errors, server_id: srv.id, _h: h });
  }
}

// ---- SQL-Seed generieren ---------------------------------------------------
function esc(s) {
  return s.replace(/'/g, "''");
}

const sqlParts = [];

// Tabellen
sqlParts.push(`CREATE TABLE servers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT,
  max_users INTEGER NOT NULL
);`);

sqlParts.push(`CREATE TABLE releases (
  id INTEGER PRIMARY KEY,
  version TEXT NOT NULL,
  released_at TEXT NOT NULL,
  note TEXT
);`);

sqlParts.push(`CREATE TABLE traffic (
  ts TEXT NOT NULL,
  users INTEGER NOT NULL,
  avg_ms INTEGER NOT NULL,
  errors INTEGER NOT NULL,
  server_id INTEGER REFERENCES servers(id)
);`);

// Server-Daten
const srvRows = SERVERS.map((s) => `(${s.id},'${esc(s.name)}','${esc(s.region)}',${s.max_users})`).join(',\n  ');
sqlParts.push(`INSERT INTO servers VALUES\n  ${srvRows};`);

// Release-Daten
const relRows = RELEASES.map((r) => `(${r.id},'${esc(r.version)}','${esc(r.released_at)}','${esc(r.note)}')`).join(',\n  ');
sqlParts.push(`INSERT INTO releases VALUES\n  ${relRows};`);

// Traffic-Daten in Batches (1000 Zeilen je INSERT fuer Lesbarkeit)
const BATCH = 500;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const vals = chunk.map((r) => `('${r.ts}',${r.users},${r.avg_ms},${r.errors},${r.server_id})`).join(',\n  '); // _h not included in SQL
  sqlParts.push(`INSERT INTO traffic VALUES\n  ${vals};`);
}

const sql = sqlParts.join('\n\n');

// ---- TypeScript-Datei schreiben -------------------------------------------
const tsContent = `// AUTOMATISCH GENERIERT – nicht von Hand bearbeiten.
// Generator: tools/gen-traffic.mjs   (Seed 0xdeadbeef)
//
// Datensatz: App-Traffic, 6 Wochen stündlich (${rows.length} Zeilen).
// Geschichte:
//   - Tagesrhythmus (nachts < 5 Nutzer, Abend-Peak ~20 Uhr)
//   - Wochenende 70 % des Wochentag-Peaks
//   - Nutzerwachstum +18 % über 6 Wochen
//   - Ab v2.4 (Woche 4): avg_ms steigt auf ~das 3-fache
//   - Fehlerrate steigt bei Auslastung > 85 %
// Kennzahlen:
//   Server 1 (eu-west-1):    max_users 220
//   Server 2 (eu-central-1): max_users 180
//   Vor v2.4: avg_ms ~80-120 ms
//   Woche 4+5 (v2.4):        avg_ms ~300-480 ms
//   Nach v2.4.1:             avg_ms ~160-260 ms

export const TRAFFIC_SEED = \`
${sql}
\`;
`;

const __dir = dirname(fileURLToPath(import.meta.url));
const outPath = new URL('../src/lib/tabula/course/traffic-data.ts', import.meta.url).pathname;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, tsContent, 'utf-8');

console.log(`Geschrieben: ${outPath}`);
console.log(`Zeilen traffic: ${rows.length}`);
console.log(`SQL-Laenge: ${(sql.length / 1024).toFixed(1)} KB`);

// Plausibilitaets-Checks
const v24Rows = rows.filter((r) => r._h >= V24_HOUR && r._h < V241_HOUR);
const preRows = rows.filter((r) => r._h < V24_HOUR);
const avgPre = preRows.reduce((s, r) => s + r.avg_ms, 0) / preRows.length;
const avgPost = v24Rows.reduce((s, r) => s + r.avg_ms, 0) / v24Rows.length;
console.log(`avg_ms vor v2.4:  ${avgPre.toFixed(1)} ms`);
console.log(`avg_ms nach v2.4: ${avgPost.toFixed(1)} ms`);
const w1Users = rows.filter((r) => r._h < 7 * 24).reduce((s, r) => s + r.users, 0) / (7 * 24 * 2);
const wLUsers = rows.filter((r) => r._h >= TOTAL_HOURS - 7 * 24).reduce((s, r) => s + r.users, 0) / (7 * 24 * 2);
console.log(`Ø Nutzer Woche 1: ${w1Users.toFixed(1)}  Letzte Woche: ${wLUsers.toFixed(1)}`);
