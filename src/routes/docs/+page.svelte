<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const sections = [
		{
			title: 'Grundlagen',
			items: [
				{ id: 'select', label: 'SELECT', blurb: 'Spalten auswählen, Ergebnisse projizieren' },
				{ id: 'from', label: 'FROM', blurb: 'Tabellen referenzieren, Aliase verwenden' },
				{ id: 'where', label: 'WHERE', blurb: 'Zeilen mit Bedingungen filtern' },
				{ id: 'order-by', label: 'ORDER BY', blurb: 'Ergebnis sortieren (ASC, DESC, NULLS)' },
				{ id: 'limit', label: 'LIMIT / OFFSET', blurb: 'Ergebnismenge beschränken' },
				{ id: 'distinct', label: 'DISTINCT', blurb: 'Doppelte Zeilen entfernen' }
			]
		},
		{
			title: 'Aggregation & Gruppierung',
			items: [
				{ id: 'count-sum-avg', label: 'COUNT, SUM, AVG, MIN, MAX', blurb: 'Aggregatfunktionen' },
				{ id: 'group-by', label: 'GROUP BY', blurb: 'Zeilen zu Gruppen zusammenfassen' },
				{ id: 'having', label: 'HAVING', blurb: 'Gruppen nach Aggregat filtern' }
			]
		},
		{
			title: 'Joins',
			items: [
				{ id: 'inner-join', label: 'INNER JOIN', blurb: 'Schnittmenge zweier Tabellen' },
				{ id: 'left-right-join', label: 'LEFT / RIGHT JOIN', blurb: 'Outer Joins mit NULL-Auffüllung' },
				{ id: 'full-join', label: 'FULL OUTER JOIN', blurb: 'Vereinigung beider Seiten' },
				{ id: 'self-join', label: 'Self Join', blurb: 'Tabelle mit sich selbst verknüpfen' }
			]
		},
		{
			title: 'Fortgeschritten',
			items: [
				{ id: 'subqueries', label: 'Subqueries', blurb: 'Verschachtelte Abfragen, IN, EXISTS' },
				{ id: 'ctes', label: 'CTEs (WITH)', blurb: 'Lesbare Zwischenergebnisse, auch rekursiv' },
				{
					id: 'window-functions',
					label: 'Window Functions',
					blurb: 'OVER, PARTITION BY, ROW_NUMBER, RANK, LAG, LEAD'
				},
				{ id: 'case', label: 'CASE WHEN', blurb: 'Bedingte Ausdrücke in SELECT und WHERE' }
			]
		},
		{
			title: 'Datentypen & Funktionen',
			items: [
				{ id: 'types', label: 'Postgres-Datentypen', blurb: 'text, int, numeric, timestamp, jsonb …' },
				{ id: 'strings', label: 'String-Funktionen', blurb: 'CONCAT, LIKE, REGEXP, SPLIT_PART' },
				{ id: 'dates', label: 'Datum & Zeit', blurb: 'NOW, AGE, DATE_TRUNC, EXTRACT' },
				{ id: 'null', label: 'NULL-Handling', blurb: 'IS NULL, COALESCE, NULLIF' }
			]
		},
		{
			title: 'DDL & DML',
			items: [
				{ id: 'create-table', label: 'CREATE TABLE', blurb: 'Schema definieren, Constraints setzen' },
				{ id: 'insert', label: 'INSERT', blurb: 'Zeilen einfügen, INSERT … SELECT' },
				{ id: 'update', label: 'UPDATE', blurb: 'Zeilen ändern' },
				{ id: 'delete', label: 'DELETE', blurb: 'Zeilen löschen' },
				{
					id: 'alter-drop',
					label: 'ALTER / DROP',
					blurb: 'Schema-Änderungen, Spalten hinzufügen/entfernen'
				}
			]
		}
	];
</script>

<svelte:head>
	<title>SQL-Referenz · SbSQLTT</title>
</svelte:head>

<main class="max-w-[960px] mx-auto px-6 pt-16 pb-24">
	<header class="mb-12">
		<div class="flex items-center gap-3 mb-4">
			<Badge tone="accent">
				<span class="font-mono text-[10.5px] tracking-wide">in Arbeit</span>
			</Badge>
		</div>
		<h1
			class="text-[36px] md:text-[44px] leading-[1.1] tracking-tight font-semibold text-ink-900"
		>
			SQL-Referenz
		</h1>
		<p class="mt-4 text-[15px] leading-relaxed text-ink-700 max-w-[60ch]">
			Kompakte Erklärungen zu allen SQL-Befehlen, die in den Lektionen vorkommen, mit
			Beispielen, häufigen Fehlern und Querverweisen auf die passenden Übungen. Diese Seite
			wächst parallel zu den Lektionen.
		</p>
	</header>

	<div class="space-y-12">
		{#each sections as section (section.title)}
			<section>
				<h2
					class="text-[11px] font-mono uppercase tracking-[0.16em] text-accent mb-4"
				>
					{section.title}
				</h2>
				<ul class="divide-y divide-ink-200 border-y border-ink-200">
					{#each section.items as item (item.id)}
						<li
							class="flex items-center justify-between gap-6 py-3.5 px-1 group cursor-not-allowed opacity-80"
							aria-disabled="true"
						>
							<div class="min-w-0">
								<div class="font-mono text-[14px] text-ink-900">{item.label}</div>
								<div class="text-[13px] text-ink-700 mt-0.5">{item.blurb}</div>
							</div>
							<span
								class="font-mono text-[11px] text-ink-600 shrink-0 inline-flex items-center gap-1"
							>
								folgt
								<Icon name="arrow" size={12} />
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>

	<aside
		class="mt-16 border border-ink-200 rounded-lg bg-ink-50 p-6 text-[14px] text-ink-700 leading-relaxed"
	>
		<div class="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-600 mb-2">
			Hinweis
		</div>
		<p>
			Solange die Referenz noch nicht fertig ist, helfen die offiziellen <a
				href="https://www.postgresql.org/docs/current/sql.html"
				target="_blank"
				rel="noreferrer"
				class="text-accent hover:underline">Postgres-Docs</a
			>
			weiter. Vorschläge oder Wünsche zu Themen, die du in der Referenz sehen willst, gerne per E-Mail
			an
			<a href="mailto:murat.meric@jmestudio.de" class="text-accent hover:underline"
				>murat.meric@jmestudio.de</a
			>
			oder als Issue auf
			<a
				href="https://github.com/WarumSindNamenSoSchwer/SbSQLTT/issues"
				target="_blank"
				rel="noreferrer"
				class="text-accent hover:underline">GitHub</a
			>.
		</p>
	</aside>
</main>

<Footer />
