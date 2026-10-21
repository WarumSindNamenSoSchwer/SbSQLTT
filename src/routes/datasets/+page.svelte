<script lang="ts">
	import '$lib/tabula/theme.css';
	import { onMount } from 'svelte';
	import TopNav from '$lib/tabula/TopNav.svelte';
	import Edgar from '$lib/edgar/Edgar.svelte';
	import { BOOKS_SEED } from '$lib/tabula/course/data';
	import { SCHOOL_SEED } from '$lib/tabula/course/l9-ddl';
	import { openDb, readSchema, exportDb, run, type Schema } from '$lib/tabula/sql';
	import type { Database } from 'sql.js';

	// ---- Python highlighter --------------------------------------------------
	function tokenizePython(code: string): { text: string; cls: string }[] {
		const tokens: { text: string; cls: string }[] = [];
		let rest = code;
		while (rest.length) {
			// string literals
			const sq = rest.match(/^('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/);
			if (sq) { tokens.push({ text: sq[0], cls: 'py-str' }); rest = rest.slice(sq[0].length); continue; }
			// keywords
			const kw = rest.match(/^(import|as|from)\b/);
			if (kw) { tokens.push({ text: kw[0], cls: 'py-kw' }); rest = rest.slice(kw[0].length); continue; }
			// any other char
			tokens.push({ text: rest[0], cls: '' });
			rest = rest.slice(1);
		}
		return tokens;
	}

	// ---- State ----------------------------------------------------------------
	let dark = $state(false);
	let selected = $state<string | null>(null);
	let toastVisible = $state(false);
	let mobileTab = $state<'schema' | 'vorschau' | 'python'>('schema');

	// DB state per dataset
	let dbBooks = $state<Database | null>(null);
	let dbSchule = $state<Database | null>(null);
	let schemasBooks = $state<Schema>([]);
	let schemasSchule = $state<Schema>([]);
	let rowCountsBooks = $state<Record<string, number>>({});
	let rowCountsSchule = $state<Record<string, number>>({});
	let previewBooks = $state<{ columns: string[]; rows: (string | number | null)[][] }>({ columns: [], rows: [] });
	let previewSchule = $state<{ columns: string[]; rows: (string | number | null)[][] }>({ columns: [], rows: [] });
	let sizeBooks = $state<number>(0);
	let sizeSchule = $state<number>(0);
	let loading = $state(true);

	// ---- Dataset definitions --------------------------------------------------
	const DATASETS = [
		{
			id: 'books',
			filename: 'bibliothek.db',
			name: 'Schulbibliothek',
			desc: 'Bücher, Verlage und Ausleihen aus der Schulbibliothek. Der Datensatz aus den SQL-Grundlagen.',
			tags: ['Einstieg', 'JOIN', 'Aggregation'],
			lektionen: 'Lektionen 1 bis 8, Lektion 10',
			seed: BOOKS_SEED,
			mainTable: 'books',
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
			tags: ['DDL', 'CREATE TABLE'],
			lektionen: 'Lektion 9',
			seed: SCHOOL_SEED,
			mainTable: 'klassen',
			python: `import sqlite3
import pandas as pd

con = sqlite3.connect("schule.db")
df = pd.read_sql(
    "SELECT * FROM klassen", con)
print(df.head())`
		}
	] as const;

	type DatasetId = (typeof DATASETS)[number]['id'];

	// ---- Helpers --------------------------------------------------------------
	function getDb(id: DatasetId): Database | null {
		return id === 'books' ? dbBooks : dbSchule;
	}
	function getSchemas(id: DatasetId): Schema {
		return id === 'books' ? schemasBooks : schemasSchule;
	}
	function getRowCounts(id: DatasetId): Record<string, number> {
		return id === 'books' ? rowCountsBooks : rowCountsSchule;
	}
	function getPreview(id: DatasetId): { columns: string[]; rows: (string | number | null)[][] } {
		return id === 'books' ? previewBooks : previewSchule;
	}
	function getSize(id: DatasetId): number {
		return id === 'books' ? sizeBooks : sizeSchule;
	}
	function fmtSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
	function tableCount(id: DatasetId): string {
		const n = getSchemas(id).length;
		return `${n} ${n === 1 ? 'Tabelle' : 'Tabellen'}`;
	}
	function metaLine(id: DatasetId): string {
		return `${tableCount(id)} · ${fmtSize(getSize(id))}`;
	}

	// ---- Load databases -------------------------------------------------------
	onMount(() => {
		// Theme sync
		const sync = () => (dark = !document.documentElement.classList.contains('light'));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		// Load databases asynchronously
		(async () => { try {
			const [db1, db2] = await Promise.all([openDb(BOOKS_SEED), openDb(SCHOOL_SEED)]);
			dbBooks = db1;
			dbSchule = db2;

			schemasBooks = readSchema(db1);
			schemasSchule = readSchema(db2);

			// Row counts
			const rc1: Record<string, number> = {};
			for (const t of schemasBooks) {
				const res = run(db1, `SELECT COUNT(*) FROM "${t.table}"`);
				rc1[t.table] = Number(res.rows[0]?.[0] ?? 0);
			}
			rowCountsBooks = rc1;

			const rc2: Record<string, number> = {};
			for (const t of schemasSchule) {
				const res = run(db2, `SELECT COUNT(*) FROM "${t.table}"`);
				rc2[t.table] = Number(res.rows[0]?.[0] ?? 0);
			}
			rowCountsSchule = rc2;

			// Preview (first 6 rows of main table)
			const prev1 = run(db1, 'SELECT * FROM books LIMIT 6');
			previewBooks = prev1;
			const prev2 = run(db2, 'SELECT * FROM klassen LIMIT 6');
			previewSchule = prev2;

			// Sizes
			sizeBooks = db1.export().byteLength;
			sizeSchule = db2.export().byteLength;
		} catch (e) {
			console.error('DB load error', e);
		} finally {
			loading = false;
		} })();

		return () => mo.disconnect();
	});

	// ---- Actions --------------------------------------------------------------
	function openDetail(id: string) {
		selected = id;
		mobileTab = 'schema';
	}
	function closeDetail() {
		selected = null;
	}

	function downloadDb(id: DatasetId) {
		const db = getDb(id);
		if (!db) return;
		const ds = DATASETS.find((d) => d.id === id)!;
		exportDb(db, ds.filename);
	}

	function downloadCsvZip(id: DatasetId) {
		const db = getDb(id);
		const schemas = getSchemas(id);
		if (!db) return;
		// Generate CSV per table, create a zip via manual blob
		// Since we can't use JSZip without importing it, we generate individual CSVs
		// and download them one by one (or best effort: download all as individual files)
		for (const t of schemas) {
			const res = run(db, `SELECT * FROM "${t.table}"`);
			const lines = [res.columns.join(',')];
			for (const row of res.rows) {
				lines.push(row.map((v) => (v === null ? '' : String(v).includes(',') || String(v).includes('"') ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(','));
			}
			const csv = lines.join('\n');
			const blob = new Blob([csv], { type: 'text/csv' });
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = `${t.table}.csv`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		}
	}

	function copyPython(id: DatasetId) {
		const ds = DATASETS.find((d) => d.id === id)!;
		navigator.clipboard.writeText(ds.python).then(() => {
			toastVisible = true;
			setTimeout(() => (toastVisible = false), 2500);
		});
	}

	const selectedDs = $derived(selected ? DATASETS.find((d) => d.id === selected) : null);
</script>

<svelte:head><title>Datensätze · Tabula</title></svelte:head>

<div class="tb page">
	<TopNav {dark} />

	<!-- ============ LIST VIEW ============ -->
	{#if !selected}
		<main class="wrap">
			<div class="inner">
				<div class="head">
					<h1 class="h1">Datensätze</h1>
					<div class="head-row">
						<span class="sub">Jede Datenbank gibt es als SQLite-Datei. Lade sie herunter und arbeite in Python weiter.</span>
						<Edgar pose="laptop" {dark} class="head-owl" />
					</div>
				</div>

				{#if loading}
					<div class="loading-grid">
						{#each [1, 2] as _}
							<div class="card-skel"></div>
						{/each}
					</div>
				{:else}
					<div class="grid">
						{#each DATASETS as ds}
							<button class="card" onclick={() => openDetail(ds.id)}>
								<div class="card-id-row">
									<span class="mono card-id">{ds.filename}</span>
									<span class="card-name">{ds.name}</span>
								</div>
								<span class="card-desc">{ds.desc}</span>
								<div class="card-meta-row">
									{#each ds.tags as tag}
										<span class="tag">{tag}</span>
									{/each}
									<span class="grow"></span>
									<span class="mono card-meta">{metaLine(ds.id as DatasetId)}</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</main>

	<!-- ============ DETAIL VIEW ============ -->
	{:else if selectedDs}
		{@const dsId = selectedDs.id as DatasetId}
		{@const schemas = getSchemas(dsId)}
		{@const rowCounts = getRowCounts(dsId)}
		{@const preview = getPreview(dsId)}
		{@const size = getSize(dsId)}
		<main class="wrap detail-wrap">
			<div class="detail-inner">
				<!-- Left column -->
				<div class="detail-main">
					<!-- Breadcrumb + title -->
					<div class="detail-head">
						<button class="back" onclick={closeDetail}><span class="arr back"></span>Alle Datensätze</button>
						<span class="mono detail-file">{selectedDs.filename}</span>
						<h1 class="h1">{selectedDs.name}</h1>
						<p class="detail-desc">{selectedDs.desc}</p>
						<span class="detail-lektionen">Verwendet in: {selectedDs.lektionen}</span>
					</div>

					<!-- Schema section -->
					<div class="section">
						<h2 class="h2">Schema</h2>
						<div class="schema-grid" style="grid-template-columns: {schemas.map((_, i) => i < schemas.length - 1 ? 'minmax(0,1fr) 64px' : 'minmax(0,1fr)').join(' ')}">
							{#each schemas as tbl, i}
								<div class="schema-table">
									<div class="schema-thead">
										<span class="mono schema-tname">▦ {tbl.table}</span>
										<span class="schema-rows">{rowCounts[tbl.table] ?? 0} Zeilen</span>
									</div>
									{#each tbl.cols as col}
										<div class="schema-row">
											<span class="mono schema-col">{col.name}</span>
											{#if col.key}
												<span class="badge-key">{col.key}</span>
											{/if}
											<span class="mono schema-type">{col.type}</span>
										</div>
									{/each}
								</div>
								{#if i < schemas.length - 1}
									<div class="schema-link" aria-hidden="true">
										<span class="schema-link-line"></span>
										<span class="mono schema-link-label">n : 1</span>
									</div>
								{/if}
							{/each}
						</div>
					</div>

					<!-- Preview section -->
					<div class="section">
						<div class="preview-head">
							<h2 class="h2">Vorschau</h2>
							<div class="tab-pill">
								{#each schemas as tbl, i}
									<span class="tab-item" class:on={i === 0}>{tbl.table}</span>
								{/each}
							</div>
						</div>
						<div class="preview-table">
							<div class="preview-thead">
								{#each preview.columns as col}
									<span class="mono preview-th">{col}</span>
								{/each}
							</div>
							{#each preview.rows as row}
								<div class="preview-row">
									{#each row as cell, ci}
										<span class:mono={ci === 0 || ci === preview.columns.length - 1} class="preview-cell">{cell ?? 'NULL'}</span>
									{/each}
								</div>
							{/each}
							<div class="preview-foot">Erste {preview.rows.length} von {rowCounts[selectedDs.mainTable] ?? preview.rows.length} Zeilen</div>
						</div>
					</div>
				</div>

				<!-- Right column (sticky) -->
				<div class="detail-side">
					<!-- Download card -->
					<div class="side-card">
						<span class="lbl">DOWNLOAD</span>
						<button class="btn primary" onclick={() => downloadDb(dsId)}>
							⬇ {selectedDs.filename} (SQLite · {fmtSize(size)})
						</button>
						<button class="btn secondary" onclick={() => downloadCsvZip(dsId)}>
							⬇ CSV je Tabelle
						</button>
						<a class="btn ghost" href="/learn">Im Browser ausprobieren<span class="arr"></span></a>
					</div>

					<!-- Python snippet -->
					<div class="pycard">
						<div class="pycard-head">
							<span class="mono pycard-label">PYTHON</span>
							<button class="copy-btn" onclick={() => copyPython(dsId)}>Kopieren</button>
						</div>
						<pre class="pycode">{#each tokenizePython(selectedDs.python) as tok}<span class={tok.cls}>{tok.text}</span>{/each}</pre>
					</div>
				</div>
			</div>
		</main>

		<!-- Mobile detail (tabs) -->
		<div class="mob-detail">
			<div class="mob-back-bar">
				<button class="back" onclick={closeDetail}><span class="arr back"></span>Alle Datensätze</button>
				<span class="mono detail-file">{selectedDs.filename}</span>
			</div>
			<div class="mob-head">
				<h1 class="mob-h1">{selectedDs.name}</h1>
				<p class="mob-desc">{selectedDs.desc}</p>
			</div>
			<div class="mob-tabs">
				<button class="mob-tab" class:on={mobileTab === 'schema'} onclick={() => (mobileTab = 'schema')}>Schema</button>
				<button class="mob-tab" class:on={mobileTab === 'vorschau'} onclick={() => (mobileTab = 'vorschau')}>Vorschau</button>
				<button class="mob-tab" class:on={mobileTab === 'python'} onclick={() => (mobileTab = 'python')}>Python</button>
			</div>
			{#if mobileTab === 'schema'}
				<div class="mob-tab-content">
					{#each schemas as tbl}
						<div class="schema-table">
							<div class="schema-thead">
								<span class="mono schema-tname">▦ {tbl.table}</span>
								<span class="schema-rows">{rowCounts[tbl.table] ?? 0} Zeilen</span>
							</div>
							{#each tbl.cols as col}
								<div class="schema-row">
									<span class="mono schema-col">{col.name}</span>
									{#if col.key}
										<span class="badge-key">{col.key}</span>
									{/if}
									<span class="mono schema-type">{col.type}</span>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			{:else if mobileTab === 'vorschau'}
				<div class="mob-tab-content overflow-x">
					<div class="preview-table">
						<div class="preview-thead">
							{#each preview.columns as col}
								<span class="mono preview-th">{col}</span>
							{/each}
						</div>
						{#each preview.rows as row}
							<div class="preview-row">
								{#each row as cell, ci}
									<span class:mono={ci === 0} class="preview-cell">{cell ?? 'NULL'}</span>
								{/each}
							</div>
						{/each}
						<div class="preview-foot">Erste {preview.rows.length} Zeilen</div>
					</div>
				</div>
			{:else}
				<div class="mob-tab-content">
					<div class="pycard">
						<div class="pycard-head">
							<span class="mono pycard-label">PYTHON</span>
							<button class="copy-btn" onclick={() => copyPython(dsId)}>Kopieren</button>
						</div>
						<pre class="pycode">{#each tokenizePython(selectedDs.python) as tok}<span class={tok.cls}>{tok.text}</span>{/each}</pre>
					</div>
				</div>
			{/if}
			<div class="mob-dl-bar">
				<button class="btn primary" onclick={() => downloadDb(dsId)}>⬇ {selectedDs.filename} herunterladen</button>
				<a class="btn ghost" href="/learn">Im Browser ausprobieren</a>
			</div>
		</div>
	{/if}

	<!-- Toast -->
	{#if toastVisible}
		<div class="toast" role="status" aria-live="polite">
			<span class="toast-ok">✓</span>Kopiert
		</div>
	{/if}
</div>


<style>
	/* Page layout */
	.page { min-height: 100dvh; display: flex; flex-direction: column; }
	.wrap { display: flex; justify-content: center; padding: 48px 40px 72px; }
	.inner { width: 1100px; max-width: 100%; display: flex; flex-direction: column; gap: 28px; }

	/* Head */
	.head { display: flex; flex-direction: column; gap: 6px; }
	.h1 { margin: 0; font-size: 36px; line-height: 44px; font-weight: 600; letter-spacing: -0.015em; }
	.h2 { margin: 0; font-size: 20px; line-height: 28px; font-weight: 600; }
	.sub { font-size: 16px; color: var(--ink-2); flex: 1; }
	.head-row { display: flex; align-items: flex-end; gap: 24px; }
	:global(.head-owl) { width: 96px; height: 86px; flex: none; }

	/* Grid */
	.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
	.loading-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
	.card-skel { height: 120px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); }

	/* Card */
	.card { display: flex; flex-direction: column; gap: 12px; padding: 20px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); text-align: left; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
	.card:hover { border-color: var(--line-strong); box-shadow: 0 2px 8px rgb(0 0 0 / .06); }
	.card-id-row { display: flex; align-items: baseline; gap: 10px; }
	.card-id { font-size: 16px; font-weight: 500; }
	.card-name { font-size: 16px; font-weight: 600; }
	.card-desc { font-size: 14px; line-height: 21px; color: var(--ink-2); }
	.card-meta-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.card-meta { font-size: 12px; color: var(--ink-3); }
	.tag { height: 24px; padding: 0 10px; border-radius: 999px; background: var(--subtle); font-size: 12px; font-weight: 500; display: inline-flex; align-items: center; color: var(--ink-2); }
	.grow { flex: 1; }

	/* Detail layout */
	.detail-wrap { padding: 36px 40px 72px; }
	.detail-inner { width: 1100px; max-width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 40px; align-items: start; }
	.detail-main { display: flex; flex-direction: column; gap: 28px; }
	.detail-side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }

	/* Detail head */
	.detail-head { display: flex; flex-direction: column; gap: 8px; }
	.back { font-size: 14px; color: var(--ink-3); display: flex; align-items: center; cursor: pointer; }
	.back:hover { color: var(--ink); }
	.detail-file { font-size: 13px; color: var(--accent-strong); }
	.detail-desc { margin: 0; font-size: 16px; line-height: 26px; color: var(--ink-2); }
	.detail-lektionen { font-size: 14px; color: var(--ink-3); }

	/* Schema */
	.section { display: flex; flex-direction: column; gap: 12px; }
	.schema-grid { display: grid; align-items: start; gap: 0; overflow-x: auto; }
	.schema-table { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow: hidden; }
	.schema-thead { padding: 10px 14px; border-bottom: 1px solid var(--line); background: var(--subtle); display: flex; align-items: center; gap: 8px; }
	.schema-tname { font-size: 14px; font-weight: 500; flex: 1; }
	.schema-rows { font-size: 12px; color: var(--ink-3); }
	.schema-row { display: flex; align-items: center; gap: 8px; padding: 7px 14px; border-bottom: 1px solid var(--line); font-size: 13px; }
	.schema-row:last-child { border-bottom: 0; }
	.schema-col { flex: 1; }
	.schema-type { color: var(--ink-3); font-size: 12px; }
	.badge-key { font-size: 10px; padding: 0 5px; border-radius: 4px; background: var(--accent-soft); color: var(--accent-ink); }
	.schema-link { align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
	.schema-link-line { width: 100%; height: 2px; background: var(--accent); display: block; }
	.schema-link-label { font-size: 10px; color: var(--accent-strong); }

	/* Preview */
	.preview-head { display: flex; align-items: center; gap: 12px; }
	.tab-pill { display: flex; padding: 3px; border-radius: 8px; background: var(--subtle); font-size: 13px; }
	.tab-item { padding: 4px 12px; border-radius: 6px; color: var(--ink-2); }
	.tab-item.on { background: var(--surface); box-shadow: 0 1px 2px rgb(15 23 42 / .1); color: var(--ink); font-weight: 500; }
	.preview-table { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow: hidden; }
	.preview-thead { display: flex; background: var(--subtle); border-bottom: 1px solid var(--line); }
	.preview-th { padding: 8px 14px; font-size: 12px; color: var(--ink-3); flex: 1; min-width: 0; }
	.preview-row { display: flex; border-bottom: 1px solid var(--line); font-size: 14px; }
	.preview-row:last-of-type { border-bottom: 1px solid var(--line); }
	.preview-cell { padding: 7px 14px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.preview-foot { padding: 8px 14px; font-size: 13px; color: var(--ink-3); }

	/* Side card */
	.side-card { display: flex; flex-direction: column; gap: 10px; padding: 20px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
	.lbl { font-family: var(--mono); font-size: 12px; letter-spacing: .06em; color: var(--ink-3); }
	.btn { display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; text-align: center; }
	.btn.primary { height: 44px; background: var(--accent); color: #fff !important; }
	.btn.primary:hover { background: var(--accent-strong); }
	.btn.secondary { height: 40px; border: 1px solid var(--line-strong); color: var(--ink); }
	.btn.secondary:hover { background: var(--subtle); }
	.btn.ghost { height: 40px; color: var(--accent-strong) !important; }
	.btn.ghost:hover { background: var(--subtle); }

	/* Python card */
	.pycard { display: flex; flex-direction: column; border-radius: 10px; background: #0f172a; overflow: hidden; }
	.pycard-head { display: flex; align-items: center; padding: 10px 14px; border-bottom: 1px solid #1e293b; }
	.pycard-label { font-size: 12px; color: #94a3b8; flex: 1; }
	.copy-btn { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 6px; background: #1e293b; color: #e2e8f0; font-size: 12px; font-weight: 500; cursor: pointer; }
	.copy-btn:hover { background: #334155; }
	.pycode { margin: 0; padding: 12px 14px; font-family: var(--mono); font-size: 12.5px; line-height: 21px; color: #e2e8f0; white-space: pre; overflow-x: auto; }
	:global(.py-kw) { color: #60a5fa; }
	:global(.py-str) { color: #86efac; }

	/* Toast */
	.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 18px; border-radius: 10px; background: #0f172a; color: #fff; font-size: 14px; font-weight: 500; box-shadow: var(--shadow-pop); z-index: 100; }
	.toast-ok { color: #4ade80; }

	/* Mobile hidden on desktop */
	.mob-detail, .mob-back-bar, .mob-head, .mob-tabs, .mob-tab-content, .mob-dl-bar { display: none; }

	/* Mono helper */
	.mono { font-family: var(--mono); }

	@media (max-width: 767px) {
		.page { font-size: 15px; line-height: 22px; }
		.wrap { padding: 20px 16px 40px; }
		.inner { gap: 16px; }
		.h1 { font-size: 28px; line-height: 34px; }
		.sub { font-size: 14px; }
		.head-row { flex-direction: column; align-items: flex-start; gap: 8px; }
		:global(.head-owl) { display: none; }
		.grid { grid-template-columns: 1fr; }

		/* Hide desktop detail on mobile */
		.detail-wrap { display: none; }

		/* Mobile detail */
		.mob-detail { display: flex; flex-direction: column; flex: 1; }
		.mob-back-bar { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--surface); }
		.mob-head { padding: 16px 16px 0; display: flex; flex-direction: column; gap: 6px; }
		.mob-h1 { margin: 0; font-size: 26px; line-height: 32px; font-weight: 600; letter-spacing: -0.01em; }
		.mob-desc { margin: 0; font-size: 14px; line-height: 21px; color: var(--ink-2); }
		.mob-tabs { display: flex; padding: 12px 16px; gap: 0; }
		.mob-tabs { padding: 10px 16px; }
		.tab-pill-mob { display: flex; padding: 3px; border-radius: 8px; background: var(--subtle); width: 100%; }
		.mob-tab { flex: 1; padding: 8px 0; border-radius: 6px; font-size: 14px; font-weight: 500; color: var(--ink-2); text-align: center; }
		.mob-tab.on { background: var(--surface); box-shadow: 0 1px 2px rgb(15 23 42 / .1); color: var(--ink); }
		.mob-tabs { display: flex; padding: 4px; margin: 8px 16px; border-radius: 8px; background: var(--subtle); }
		.mob-tab-content { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
		.mob-dl-bar { flex: none; padding: 12px 16px 20px; border-top: 1px solid var(--line); background: var(--surface); display: flex; flex-direction: column; gap: 8px; }
		.overflow-x { overflow-x: auto; }
	}
</style>
