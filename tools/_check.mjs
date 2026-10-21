import initSqlJs from 'sql.js';
const { compare } = await import('../src/lib/tabula/sql.ts');
const mods = ['l1-select','l2-columns','l3-where','l4-order','l5-aggregates','l6-group','l7-joins','l8-subqueries','l9-ddl'];
const SQL = await initSqlJs(); let bad = 0;
const run = (db, q) => { const r = db.exec(q); const l = r[r.length-1]; return l ? { columns: l.columns, rows: l.values } : { columns: [], rows: [] }; };
const exec = (db, q, c) => { db.run('SAVEPOINT t'); try { const a = run(db, q); return c ? run(db, c) : a; } finally { db.run('ROLLBACK TO t; RELEASE t'); } };
for (const m of mods) {
  const L = Object.values(await import(`../src/lib/tabula/course/${m}.ts`)).find(x => x && x.steps);
  const db = new SQL.Database(); db.run(L.db.seed);
  const exs = L.steps.filter(s => s.kind === 'exercise');
  console.log(`${L.no} ${L.title}: ${exs.length} Übungen`);
  for (const s of exs) {
    try {
      const want = exec(db, s.solution, s.check);
      if (!want.rows.length) { console.log('  LEER', s.name); bad++; continue; }
      let w; try { w = compare(exec(db, s.wrong, s.check), want, s.ordered); } catch (e) { w = { ok: false, err: e.message }; }
      if (w.ok) { console.log('  WRONG AKZEPTIERT', s.name); bad++; }
    } catch (e) { console.log('  FEHLER', s.name, e.message); bad++; }
  }
}
console.log('Probleme:', bad);
