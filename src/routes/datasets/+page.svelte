<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import SiteFooter from '$lib/tabula/SiteFooter.svelte';
	import G from '$lib/edgar/owl-gen.js';
	import { BOOKS_SEED } from '$lib/tabula/course/data';
	import { SCHOOL_SEED } from '$lib/tabula/course/l9-ddl';
	import { TRAFFIC_SEED } from '$lib/tabula/course/traffic-data';
	import { openDb, readSchema, exportDb, run, runIsolated, explainError, type Schema } from '$lib/tabula/sql';
	import type { Database } from 'sql.js';

	// ---- Python highlighter --------------------------------------------------
	function tokenizePython(code: string): { text: string; cls: string }[] {
		const tokens: { text: string; cls: string }[] = [];
		let rest = code;
		while (rest.length) {
			const sq = rest.match(/^('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/);
			if (sq) { tokens.push({ text: sq[0], cls: 'py-str' }); rest = rest.slice(sq[0].length); continue; }
			const kw = rest.match(/^(import|as|from)\b/);
			if (kw) { tokens.push({ text: kw[0], cls: 'py-kw' }); rest = rest.slice(kw[0].length); continue; }
			tokens.push({ text: rest[0], cls: '' });
			rest = rest.slice(1);
		}
		return tokens;
	}

	// ---- State ---------------------------------------------------------------
	let dark = $state(false);
	let selectedId = $state('books');
	let copyLabel = $state('Kopieren');
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;

	// DB per dataset
	let dbMap = $state<Record<string, Database | null>>({ books: null, schule: null, traffic: null });
	let schemasMap = $state<Record<string, Schema>>({ books: [], schule: [], traffic: [] });
	let rowCountsMap = $state<Record<string, Record<string, number>>>({ books: {}, schule: {}, traffic: {} });
	let sizeMap = $state<Record<string, number>>({ books: 0, schule: 0, traffic: 0 });
	let loading = $state(true);
	let failed = $state(false);

	// Preview
	let previewTableMap = $state<Record<string, string>>({ books: 'books', schule: 'klassen', traffic: 'traffic' });

	// SQL query section
	let queryMap = $state<Record<string, string>>({
		books: 'SELECT * FROM books LIMIT 10',
		schule: 'SELECT * FROM klassen LIMIT 10',
		traffic: 'SELECT * FROM traffic LIMIT 10'
	});
	let qResultMap = $state<Record<string, { columns: string[]; rows: (string | number | null)[][] } | null>>({});
	let qErrMap = $state<Record<string, string | null>>({});
	let qRunning = $state(false);
	let headOwlEl = $state<HTMLElement | null>(null);

	// ---- Dataset definitions -------------------------------------------------
	const DATASETS = [
		{
			id: 'books',
			filename: 'bibliothek.db',
			name: 'Schulbibliothek',
			desc: 'Bücher, Verlage und Ausleihen aus der Schulbibliothek. Der Datensatz aus den SQL-Grundlagen.',
			story: 'Eine fiktive Schulbibliothek mit Büchern, Verlagen und Ausleihen. Gut für JOINs, Aggregationen und Unterabfragen.',
			tags: ['Einstieg', 'JOIN', 'Aggregation'],
			lektionen: 'Lektionen 1 bis 8, Lektion 10',
			mainTable: 'books',
			seed: BOOKS_SEED,
			python: `import sqlite3
import pandas as pd

con = sqlite3.connect("bibliothek.db")
df = pd.read_sql(
    "SELECT * FROM books", con)
print(df.head())`
		},
		{
			id: 'schule',
			filename: 'schule.db',
			name: 'Schule',
			desc: 'Klassen einer Schule. Wird für Lektion 9 (Eigene Datenbank entwerfen) verwendet.',
			story: 'Eine Schule mit Klassen, Schülern und Kursen. Gedacht für Lektion 9 (DDL, eigene Tabellen entwerfen).',
			tags: ['DDL', 'CREATE TABLE'],
			lektionen: 'Lektion 9',
			mainTable: 'klassen',
			seed: SCHOOL_SEED,
			python: `import sqlite3
import pandas as pd

con = sqlite3.connect("schule.db")
df = pd.read_sql(
    "SELECT * FROM klassen", con)
print(df.head())`
		},
		{
			id: 'traffic',
			filename: 'app-traffic.db',
			name: 'App-Traffic',
			desc: 'Stündliche Server-Messdaten über 6 Wochen. Nutzerwachstum, Antwortzeiten und eine kritische Version v2.4.',
			story: 'Zwei Server, 2016 stündliche Messungen. Ein Software-Update (v2.4) verschlechtert die Antwortzeit drastisch. Typischer Analysedatensatz für Python und SQL.',
			tags: ['Zeitreihe', 'JOIN', 'Aggregation', 'Python'],
			lektionen: 'Python-Lektion 11',
			mainTable: 'traffic',
			seed: TRAFFIC_SEED,
			python: `import sqlite3
import pandas as pd

con = sqlite3.connect("app-traffic.db")
df = pd.read_sql(
    "SELECT * FROM traffic", con)
print(df.head())`
		}
	] as const;

	type DatasetId = (typeof DATASETS)[number]['id'];

	// ---- Derived helpers -----------------------------------------------------
	const selected = $derived(DATASETS.find(d => d.id === selectedId) ?? DATASETS[0]);
	const dsId = $derived(selected.id as DatasetId);
	const db = $derived(dbMap[dsId]);
	const schemas = $derived(schemasMap[dsId] ?? []);
	const rowCounts = $derived(rowCountsMap[dsId] ?? {});
	const size = $derived(sizeMap[dsId] ?? 0);
	const previewTable = $derived(previewTableMap[dsId] ?? selected.mainTable);
	const preview = $derived.by(() => {
		const d = db;
		if (!d) return { columns: [] as string[], rows: [] as (string | number | null)[][] };
		try { return run(d, `SELECT * FROM "${previewTable}" LIMIT 6`); }
		catch { return { columns: [] as string[], rows: [] as (string | number | null)[][] }; }
	});
	const tableCount = $derived(`${schemas.length} ${schemas.length === 1 ? 'Tabelle' : 'Tabellen'}`);
	const noDb = $derived(!db);

	function fmtSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
	const metaLine = $derived(`${tableCount} · ${fmtSize(size)}`);

	// SQL query state for current dataset
	const q = $derived(queryMap[dsId] ?? '');
	const qResult = $derived(qResultMap[dsId] ?? null);
	const qErr = $derived(qErrMap[dsId] ?? null);

	// ---- Owl head portrait ---------------------------------------------------
	function paintHeadOwl() {
		if (!headOwlEl) return;
		const opt = dark ? G.DARK : {};
		const svg = G.owl({ ...(G.STATES?.['laptop'] || {}), ...opt });
		headOwlEl.innerHTML = svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" aria-hidden="true" ');
	}

	// ---- Load databases ------------------------------------------------------
	onMount(() => {
		const sync = () => { dark = !document.documentElement.classList.contains('light'); };
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		(async () => {
			try {
				const [db1, db2, db3] = await Promise.all([openDb(BOOKS_SEED), openDb(SCHOOL_SEED), openDb(TRAFFIC_SEED)]);
				dbMap = { books: db1, schule: db2, traffic: db3 };

				const sc1 = readSchema(db1);
				const sc2 = readSchema(db2);
				const sc3 = readSchema(db3);
				schemasMap = { books: sc1, schule: sc2, traffic: sc3 };

				const rc1: Record<string, number> = {};
				for (const t of sc1) {
					rc1[t.table] = Number(run(db1, `SELECT COUNT(*) FROM "${t.table}"`).rows[0]?.[0] ?? 0);
				}
				const rc2: Record<string, number> = {};
				for (const t of sc2) {
					rc2[t.table] = Number(run(db2, `SELECT COUNT(*) FROM "${t.table}"`).rows[0]?.[0] ?? 0);
				}
				const rc3: Record<string, number> = {};
				for (const t of sc3) {
					rc3[t.table] = Number(run(db3, `SELECT COUNT(*) FROM "${t.table}"`).rows[0]?.[0] ?? 0);
				}
				rowCountsMap = { books: rc1, schule: rc2, traffic: rc3 };
				sizeMap = { books: db1.export().byteLength, schule: db2.export().byteLength, traffic: db3.export().byteLength };
			} catch (e) {
				console.error('DB load error', e);
				failed = true;
			} finally {
				loading = false;
			}
		})();

		return () => mo.disconnect();
	});

	$effect(() => {
		if (headOwlEl) paintHeadOwl();
	});

	$effect(() => {
		// repaint owls when dark changes
		dark;
		if (headOwlEl) paintHeadOwl();
	});

	// ---- Actions -------------------------------------------------------------
	function downloadDb() {
		const d = db;
		if (!d) return;
		exportDb(d, selected.filename);
	}

	function downloadCsvZip() {
		const d = db;
		if (!d) return;
		for (const t of schemas) {
			const res = run(d, `SELECT * FROM "${t.table}"`);
			const lines = [res.columns.join(',')];
			for (const row of res.rows) {
				lines.push(row.map(v => v === null ? '' : (String(v).includes(',') || String(v).includes('"') ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(','));
			}
			const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = `${t.table}.csv`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		}
	}

	function copyPython() {
		navigator.clipboard.writeText(selected.python).then(() => {
			copyLabel = 'Kopiert';
			if (copyTimeout) clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => { copyLabel = 'Kopieren'; }, 2000);
		});
	}

	function runQuery() {
		const d = db;
		const id = dsId;
		if (!d) return;
		qRunning = true;
		try {
			const res = runIsolated(d, queryMap[id] ?? '');
			qResultMap = { ...qResultMap, [id]: res };
			qErrMap = { ...qErrMap, [id]: null };
		} catch (err) {
			const ex = explainError(queryMap[id] ?? '', err);
			qErrMap = { ...qErrMap, [id]: ex.msg };
			qResultMap = { ...qResultMap, [id]: null };
		} finally {
			qRunning = false;
		}
	}

	function handleQueryKey(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			runQuery();
		}
	}
</script>

<svelte:head><title>Datensätze · Tabula</title></svelte:head>

<div class="tb page datasets-page">
	<TopNav {dark} />

	<main style="max-width:1680px;width:100%;margin:0 auto;padding:28px clamp(16px,3vw,48px) 80px;overflow-x:hidden">

		<!-- Header -->
		<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-bottom:24px">
			<span bind:this={headOwlEl} style="width:84px;height:76px;flex:none;display:block"></span>
			<div style="flex:1 1 320px">
				<h1 style="margin:0;font-size:clamp(28px,2.4vw,40px);font-weight:600;letter-spacing:-.025em;line-height:1.1">Datensätze</h1>
				<p style="margin:6px 0 0;font-size:16px;line-height:1.55;color:var(--ink-2);max-width:62ch">Die Datenbanken aus den Lektionen zum Herunterladen. Für Python, den DB Browser for SQLite oder eigene Projekte.</p>
			</div>
		</div>

		<div class="ds-layout" style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start">

			<!-- Left: dataset list -->
			<nav aria-label="Datensatz wählen" class="ds-nav" style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:8px">
				{#each DATASETS as ds}
					{@const isSel = selectedId === ds.id}
					<button
						type="button"
						onclick={() => { selectedId = ds.id; }}
						aria-current={isSel ? 'true' : 'false'}
						style="display:flex;flex-direction:column;gap:8px;width:100%;text-align:left;padding:16px 16px 14px;border:1px solid {isSel ? 'var(--accent)' : 'var(--line)'};border-radius:12px;background:{isSel ? 'var(--accent-soft)' : 'var(--surface)'};cursor:pointer;transition:border-color .2s,background .2s"
						class="ds-btn"
					>
						<span style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
							<span style="font-size:16px;font-weight:600;color:var(--ink)">{ds.name}</span>
							<span style="font:12px 'IBM Plex Mono',monospace;color:var(--ink-3)">{ds.filename}</span>
						</span>
						<span style="font-size:14px;line-height:1.5;color:var(--ink-2)">{ds.desc}</span>
						<span style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
							{#each ds.tags as tag}
								<span style="font-size:12px;font-weight:500;padding:2px 8px;border-radius:5px;background:var(--subtle);color:var(--ink-2)">{tag}</span>
							{/each}
							<span style="font-size:12px;color:var(--ink-3);margin-left:auto;font-variant-numeric:tabular-nums">{metaLine}</span>
						</span>
					</button>
				{/each}
			</nav>

			<!-- Right: detail -->
			<section aria-label="Datensatz-Details" class="ds-detail" style="flex:999 1 640px;min-width:0;display:flex;flex-direction:column;gap:20px">

				<!-- Detail header card -->
				<div style="background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:clamp(20px,2vw,28px);display:flex;flex-wrap:wrap;gap:20px 40px;align-items:flex-start">
					<div style="flex:1 1 420px;min-width:0">
						<p style="margin:0 0 4px;font:13px 'IBM Plex Mono',monospace;color:var(--accent-ink)">{selected.filename}</p>
						<h2 style="margin:0;font-size:clamp(24px,2vw,32px);font-weight:600;letter-spacing:-.02em">{selected.name}</h2>
						<p style="margin:10px 0 0;font-size:16px;line-height:1.6;color:var(--ink-2);max-width:68ch;text-wrap:pretty">{selected.story}</p>
						<p style="margin:10px 0 0;font-size:14px;color:var(--ink-3)">Verwendet in: {selected.lektionen} · <span style="font-variant-numeric:tabular-nums">{metaLine}</span></p>
					</div>
					<div style="flex:0 1 280px;display:flex;flex-direction:column;gap:8px">
						<button
							type="button"
							onclick={downloadDb}
							disabled={noDb}
							style="display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border:0;border-radius:8px;background:var(--accent);color:#fff;font-size:15px;font-weight:600;cursor:pointer;opacity:{noDb ? '0.5' : '1'}"
							class="dl-btn"
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"></path></svg>
							{selected.filename} · {fmtSize(size)}
						</button>
						<button
							type="button"
							onclick={downloadCsvZip}
							disabled={noDb}
							style="display:flex;align-items:center;justify-content:center;gap:8px;height:40px;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-size:14px;font-weight:500;cursor:pointer;color:var(--ink)"
							class="csv-btn"
						>Alle Tabellen als CSV</button>
					</div>
				</div>

				<!-- Loading / Error -->
				{#if loading}
					<div style="display:flex;align-items:center;gap:12px;padding:24px;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--ink-2);font-size:14px">
						<span style="width:16px;height:16px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:tbSpin .7s linear infinite;flex:none"></span>Datenbank wird geladen …
					</div>
				{:else if failed}
					<div style="display:flex;align-items:center;gap:16px;padding:20px 24px;border:1px solid var(--danger-line);border-radius:14px;background:var(--danger-soft)">
						<p style="margin:0;flex:1;font-size:15px;color:var(--danger-ink)">Datenbank konnte nicht geladen werden. Lade die Seite neu.</p>
					</div>
				{:else}
					<!-- Schema + Python -->
					<div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start">

						<!-- Schema -->
						<div style="flex:1 1 460px;min-width:0;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden">
							<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--line)">
								<h3 style="margin:0;font-size:15px;font-weight:600">Schema</h3>
								<span style="font-size:13px;color:var(--ink-3)">{tableCount}</span>
							</div>
							<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;padding:16px">
								{#each schemas as tbl}
									<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden">
										<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:9px 12px;background:var(--subtle);border-bottom:1px solid var(--line)">
											<span style="font:600 13px 'IBM Plex Mono',monospace">{tbl.table}</span>
											<span style="font-size:12px;color:var(--ink-3);font-variant-numeric:tabular-nums">{rowCounts[tbl.table] ?? 0} Zeilen</span>
										</div>
										{#each tbl.cols as col}
											<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-top:1px solid var(--line);font:13px 'IBM Plex Mono',monospace">
												<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">{col.name}</span>
												<span style="font-size:11px;color:var(--ink-3)">{col.type}</span>
												{#if col.key}
													<span style="font-size:10px;font-weight:600;min-width:18px;text-align:right;color:var(--accent-ink)">{col.key}</span>
												{/if}
											</div>
										{/each}
									</div>
								{/each}
							</div>
						</div>

						<!-- Python -->
						<div style="flex:1 1 380px;min-width:0;border-radius:14px;overflow:hidden;background:#0f172a;color:#e2e8f0">
							<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 10px 18px;border-bottom:1px solid #1e293b">
								<h3 style="margin:0;font-size:14px;font-weight:600;color:#e2e8f0">In Python öffnen</h3>
								<button
									type="button"
									onclick={copyPython}
									style="height:30px;padding:0 12px;border:0;border-radius:6px;background:#1e293b;color:#e2e8f0;font-size:13px;font-weight:500;cursor:pointer"
									class="copy-py-btn"
								>{copyLabel}</button>
							</div>
							<pre style="margin:0;padding:14px 18px;font:13px/22px 'IBM Plex Mono',monospace;white-space:pre;overflow-x:auto;color:#e2e8f0">{#each tokenizePython(selected.python) as tok}<span class={tok.cls || undefined}>{tok.text}</span>{/each}</pre>
							<p style="margin:0;padding:10px 18px 14px;font-size:13px;line-height:1.5;color:#94a3b8">Lade die .db-Datei herunter und lege sie in denselben Ordner wie dein Skript.</p>
						</div>
					</div>

					<!-- Preview -->
					<div style="background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden">
						<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 12px 10px 18px;border-bottom:1px solid var(--line)">
							<h3 style="margin:0;font-size:15px;font-weight:600;margin-right:auto">Vorschau</h3>
							<div role="tablist" aria-label="Tabelle wählen" style="display:flex;gap:2px;padding:3px;border-radius:8px;background:var(--subtle)">
								{#each schemas as tbl}
									<button
										type="button"
										role="tab"
										aria-selected={tbl.table === previewTable ? 'true' : 'false'}
										onclick={() => { previewTableMap = { ...previewTableMap, [dsId]: tbl.table }; }}
										style="height:30px;padding:0 12px;border:0;border-radius:6px;background:{tbl.table === previewTable ? 'var(--surface)' : 'transparent'};color:{tbl.table === previewTable ? 'var(--ink)' : 'var(--ink-2)'};font:500 13px 'IBM Plex Mono',monospace;cursor:pointer;box-shadow:{tbl.table === previewTable ? '0 1px 3px rgb(15 23 42/.15)' : 'none'}"
									>{tbl.table}</button>
								{/each}
							</div>
						</div>
						<div style="overflow:auto;max-height:440px">
							<table style="width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums">
								<thead>
									<tr>
										{#each preview.columns as col}
											<th style="position:sticky;top:0;text-align:left;padding:8px 16px;font:500 12px 'IBM Plex Mono',monospace;color:var(--ink-2);background:var(--subtle);border-bottom:1px solid var(--line);white-space:nowrap">{col}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each preview.rows as row}
										<tr class="pvrow">
											{#each row as cell}
												<td style="padding:8px 16px;border-bottom:1px solid var(--line);white-space:nowrap;color:{cell === null ? 'var(--ink-3)' : 'var(--ink)'};font-style:{cell === null ? 'italic' : 'normal'}">{cell === null ? 'NULL' : cell}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<p style="margin:0;padding:10px 18px;font-size:13px;color:var(--ink-3)">Erste {preview.rows.length} von {rowCounts[previewTable] ?? preview.rows.length} Zeilen</p>
					</div>

					<!-- Selbst abfragen -->
					<div style="background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden">
						<div style="display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--line)">
							<div style="flex:1;min-width:0">
								<h3 style="margin:0;font-size:15px;font-weight:600">Selbst abfragen</h3>
								<p style="margin:2px 0 0;font-size:13px;color:var(--ink-3)">Freies SQL auf diesem Datensatz. Änderungen werden nach jeder Abfrage zurückgesetzt.</p>
							</div>
						</div>
						<div style="display:flex;flex-wrap:wrap">
							<!-- Editor -->
							<div style="flex:1 1 420px;min-width:0;border-right:1px solid var(--line);display:flex;flex-direction:column">
								<textarea
									aria-label="SQL-Abfrage"
									spellcheck="false"
									autocomplete="off"
									rows="6"
									onkeydown={handleQueryKey}
									oninput={(e) => { queryMap = { ...queryMap, [dsId]: (e.target as HTMLTextAreaElement).value }; }}
									value={q}
									style="display:block;width:100%;margin:0;padding:14px 16px;border:0;resize:vertical;background:var(--code-bg);color:var(--ink);caret-color:var(--accent);font:14px/22px 'IBM Plex Mono',monospace;outline:none;min-height:130px"
								></textarea>
								<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-top:1px solid var(--line)">
									<button
										type="button"
										onclick={runQuery}
										disabled={noDb || qRunning}
										style="display:flex;align-items:center;gap:8px;height:38px;padding:0 16px;border:0;border-radius:7px;background:var(--accent);color:#fff;font-size:14px;font-weight:600;cursor:pointer;opacity:{noDb ? '0.5' : '1'}"
										class="run-btn"
									>
										<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"></path></svg>Ausführen
									</button>
									<span style="font-size:13px;color:var(--ink-3)">Strg / ⌘ + Enter</span>
								</div>
							</div>
							<!-- Result -->
							<div style="flex:1 1 420px;min-width:0;display:flex;flex-direction:column">
								{#if qErr}
									<div style="padding:14px 18px;background:var(--danger-soft);border-bottom:1px solid var(--danger-line)">
										<p style="margin:0;font-size:15px;font-weight:600;color:var(--danger-ink)">Fehler</p>
										<p style="margin:4px 0 0;font:13px/1.5 'IBM Plex Mono',monospace;color:var(--danger-ink)">{qErr}</p>
									</div>
								{:else if qResult}
									<div style="overflow:auto;max-height:300px">
										<table style="width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums">
											<thead>
												<tr>
													{#each qResult.columns as col}
														<th style="position:sticky;top:0;text-align:left;padding:7px 14px;font:500 12px 'IBM Plex Mono',monospace;color:var(--ink-2);background:var(--subtle);border-bottom:1px solid var(--line);white-space:nowrap">{col}</th>
													{/each}
												</tr>
											</thead>
											<tbody>
												{#each qResult.rows as row}
													<tr class="pvrow">
														{#each row as cell}
															<td style="padding:7px 14px;border-bottom:1px solid var(--line);white-space:nowrap;color:{cell === null ? 'var(--ink-3)' : 'var(--ink)'};font-style:{cell === null ? 'italic' : 'normal'};font-family:'IBM Plex Mono',monospace">{cell === null ? 'NULL' : cell}</td>
														{/each}
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
									<p style="margin:0;padding:8px 14px;font-size:13px;color:var(--ink-3)">{qResult.rows.length} {qResult.rows.length === 1 ? 'Zeile' : 'Zeilen'}</p>
								{:else}
									<p style="margin:0;padding:24px 18px;font-size:14px;color:var(--ink-3)">Ergebnis erscheint hier nach dem Ausführen.</p>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</section>
		</div>
	</main>
	<SiteFooter />
</div>

<style>
	@keyframes tbSpin { to { transform: rotate(360deg); } }
	@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }

	/* Reset content-box from .tb global rule so flex/grid calcs are correct */
	:global(.page.datasets-page), :global(.page.datasets-page *), :global(.page.datasets-page *::before), :global(.page.datasets-page *::after) { box-sizing: border-box; }

	.page { min-height: 100dvh; display: flex; flex-direction: column; background: var(--bg); color: var(--ink); font-family: var(--sans); }

	.ds-btn:not([aria-current="true"]):hover {
		border-color: var(--line-strong) !important;
	}
	.dl-btn:not(:disabled):hover { background: var(--accent-strong) !important; }
	.csv-btn:hover { background: var(--subtle) !important; }
	.copy-py-btn:hover { background: #334155 !important; }
	.run-btn:not(:disabled):hover { background: var(--accent-strong) !important; }
	.pvrow:hover td { background: var(--subtle); }

	/* Mobile: stack list above detail */
	@media (max-width: 899px) {
		:global(.datasets-page .ds-layout) { flex-direction: column !important; }
		:global(.datasets-page .ds-nav) { flex: none !important; width: 100% !important; max-width: none !important; }
		:global(.datasets-page .ds-detail) { flex: none !important; width: 100% !important; }
	}

	:global(.py-kw) { color: #60a5fa; }
	:global(.py-str) { color: #86efac; }
</style>
