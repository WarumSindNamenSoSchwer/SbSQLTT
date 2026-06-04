<script lang="ts">
	import type { TeacherClass } from '$lib/teacher-data';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	let {
		open,
		cls,
		onClose
	}: { open: boolean; cls: TeacherClass; onClose: () => void } = $props();

	let fullscreen = $state(false);
	let showName = $state(true);
	let showUrl = $state(false);

	$effect(() => {
		if (!open) return;
		fullscreen = false;
		showName = true;
		showUrl = false;
	});

	$effect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				if (fullscreen) fullscreen = false;
				else onClose();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	let url = $derived(`sbsqltt.de/k/${cls.joinCode}`);

	const FULLSCREEN_QR = 620;
	const MODAL_QR = 260;

	function placeholderStripes(size: number, step: number) {
		const out: number[] = [];
		for (let y = 0; y < size; y += step) out.push(y);
		return out;
	}
</script>

{#if open}
	{#if fullscreen}
		<div
			class="fixed inset-0 z-50 fade-in bg-ink-0 text-ink-900"
			role="dialog"
			aria-modal="true"
		>
			<button
				onclick={() => (fullscreen = false)}
				class="absolute top-6 right-6 md:top-8 md:right-8 z-10 w-10 h-10 grid place-items-center rounded-md text-ink-700 hover:text-ink-900 hover:bg-ink-100 border border-ink-200"
				aria-label="Vollbild verlassen (ESC)"
				title="Vollbild verlassen (ESC)"
			>
				<Icon name="close" size={16} />
			</button>

			<div
				class="h-full overflow-y-auto grid place-items-center px-12 md:px-20 py-12 md:py-16"
			>
				<div class="text-center max-w-full">
					<div
						class="font-mono text-[clamp(11px,1.6vmin,14px)] tracking-[0.16em] uppercase text-ink-600 mb-[clamp(16px,3vmin,40px)]"
					>
						SbSQLTT · Einer Klasse beitreten
					</div>

					<div class="grid place-items-center">
						<div
							class="rounded-2xl border border-ink-200 bg-ink-50"
							style="padding: clamp(12px, 2vmin, 24px)"
						>
							<svg
								viewBox="0 0 {FULLSCREEN_QR} {FULLSCREEN_QR}"
								class="block"
								style="width: clamp(220px, 50vmin, {FULLSCREEN_QR}px); height: auto"
							>
								<rect width={FULLSCREEN_QR} height={FULLSCREEN_QR} fill="rgb(var(--ink-100))" />
								{#each placeholderStripes(FULLSCREEN_QR, 16) as y (y)}
									<line
										x1="0"
										y1={y + 0.5}
										x2={FULLSCREEN_QR}
										y2={y + 0.5}
										stroke="rgb(var(--ink-300))"
										stroke-width="1"
									/>
								{/each}
								{#each [[20, 20], [FULLSCREEN_QR - 112, 20], [20, FULLSCREEN_QR - 112]] as [x, y] (x + '_' + y)}
									<rect
										{x}
										{y}
										width="92"
										height="92"
										rx="4"
										fill="none"
										stroke="rgb(var(--ink-900))"
										stroke-width="9"
									/>
									<rect
										x={x + 30}
										y={y + 30}
										width="32"
										height="32"
										rx="1.5"
										fill="rgb(var(--ink-900))"
									/>
								{/each}
								<rect
									x={FULLSCREEN_QR / 2 - 110}
									y={FULLSCREEN_QR / 2 - 24}
									width="220"
									height="48"
									rx="8"
									fill="rgb(var(--ink-50))"
									stroke="rgb(var(--ink-300))"
								/>
								<text
									x={FULLSCREEN_QR / 2}
									y={FULLSCREEN_QR / 2 + 6}
									text-anchor="middle"
									font-family="JetBrains Mono, monospace"
									font-size="18"
									fill="rgb(var(--ink-700))">QR-Code Platzhalter</text
								>
							</svg>
						</div>
					</div>

					{#if showName}
						<div
							class="mt-[clamp(16px,3vmin,40px)] text-[clamp(20px,4vmin,36px)] font-semibold tracking-tight text-ink-900"
							style="text-wrap: balance"
						>
							{cls.name}
						</div>
					{/if}
					<div
						class="mt-[clamp(8px,1.5vmin,16px)] font-mono text-[clamp(40px,8vmin,72px)] leading-none tracking-tight text-accent"
					>
						{cls.joinCode}
					</div>
					{#if showUrl}
						<div
							class="mt-[clamp(8px,1.5vmin,18px)] font-mono text-[clamp(13px,2vmin,20px)] text-ink-700"
						>
							{url}
						</div>
					{/if}

					<div
						class="mt-[clamp(16px,3vmin,48px)] font-mono text-[clamp(11px,1.5vmin,13px)] text-ink-600"
					>
						Schülergeräte müssen mit dem WLAN verbunden sein.
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div
			class="ms-overlay fade-in"
			role="dialog"
			aria-modal="true"
			aria-labelledby="qr-title"
		>
			<button
				aria-label="Schließen"
				class="absolute inset-0 bg-black/55 backdrop cursor-default"
				onclick={onClose}
			></button>
			<div class="ms-card ms-w-lg">
				<span class="ms-handle"></span>
				<div>
					<div
						class="flex items-start justify-between p-6 border-b border-ink-200"
					>
						<div>
							<div
								class="text-[11px] font-mono uppercase tracking-[0.14em] text-accent"
							>
								Beitritt
							</div>
							<h2
								id="qr-title"
								class="mt-1 text-[20px] font-semibold tracking-tight text-ink-900"
							>
								QR-Code für die Tafel
							</h2>
						</div>
						<button
							onclick={onClose}
							class="w-8 h-8 grid place-items-center rounded-md text-ink-600 hover:text-ink-900 hover:bg-ink-100"
							aria-label="Schließen"
						>
							<Icon name="close" size={14} />
						</button>
					</div>

					<div class="p-6 grid sm:grid-cols-[auto_1fr] gap-6 items-center">
						<div class="rounded-lg border border-ink-200 p-4 bg-ink-50">
							<svg
								width={MODAL_QR}
								height={MODAL_QR}
								viewBox="0 0 {MODAL_QR} {MODAL_QR}"
								class="block"
								role="img"
								aria-label={'QR-Code Platzhalter für ' + cls.joinCode}
							>
								<rect width={MODAL_QR} height={MODAL_QR} fill="rgb(var(--ink-100))" />
								{#each placeholderStripes(MODAL_QR, 12) as y (y)}
									<line
										x1="0"
										y1={y + 0.5}
										x2={MODAL_QR}
										y2={y + 0.5}
										stroke="rgb(var(--ink-300))"
										stroke-width="1"
									/>
								{/each}
								{#each [[12, 12], [MODAL_QR - 68, 12], [12, MODAL_QR - 68]] as [x, y] (x + '_' + y)}
									<rect
										{x}
										{y}
										width="56"
										height="56"
										rx="3"
										fill="none"
										stroke="rgb(var(--ink-900))"
										stroke-width="6"
									/>
									<rect
										x={x + 18}
										y={y + 18}
										width="20"
										height="20"
										rx="1"
										fill="rgb(var(--ink-900))"
									/>
								{/each}
								<rect
									x={MODAL_QR / 2 - 64}
									y={MODAL_QR / 2 - 18}
									width="128"
									height="36"
									rx="6"
									fill="rgb(var(--ink-50))"
									stroke="rgb(var(--ink-300))"
								/>
								<text
									x={MODAL_QR / 2}
									y={MODAL_QR / 2 + 5}
									text-anchor="middle"
									font-family="JetBrains Mono, monospace"
									font-size="13"
									fill="rgb(var(--ink-700))">QR-Code</text
								>
							</svg>
						</div>
						<div>
							<div
								class="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-600"
							>
								Beitritts-Code
							</div>
							<div class="mt-1 font-mono text-[28px] tracking-tight text-ink-900">
								{cls.joinCode}
							</div>
							<ol
								class="mt-5 space-y-2 text-[13px] text-ink-700 list-decimal list-inside marker:text-ink-600 marker:font-mono"
							>
								<li>sbsqltt.de öffnen</li>
								<li>„Einer Klasse beitreten" antippen</li>
								<li>
									Code <span class="font-mono text-ink-900">{cls.joinCode}</span> eingeben
								</li>
							</ol>
						</div>
					</div>

					<div class="px-6 pb-6 space-y-2">
						<div
							class="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-700"
						>
							Optionen
						</div>
						{#each [{ key: 'showName', label: 'Klassenname zeigen', hint: `„${cls.name}" wird unter dem QR-Code groß angezeigt.` }, { key: 'showUrl', label: 'Beitritts-URL als Text zeigen', hint: `Zusätzlicher Textfallback: ${url}` }] as row (row.key)}
							{@const v = row.key === 'showName' ? showName : showUrl}
							<button
								type="button"
								onclick={() => {
									if (row.key === 'showName') showName = !showName;
									else showUrl = !showUrl;
								}}
								class="w-full flex items-start justify-between gap-4 text-left p-3 -mx-3 rounded-md hover:bg-ink-100/60"
							>
								<div class="min-w-0">
									<div class="text-[13.5px] font-medium text-ink-900">
										{row.label}
									</div>
									<div class="text-[12px] text-ink-700 mt-0.5">{row.hint}</div>
								</div>
								<span
									class={'shrink-0 inline-flex items-center w-9 h-5 rounded-full transition-colors mt-1 ' +
										(v ? 'bg-accent' : 'bg-ink-300')}
								>
									<span
										class={'inline-block w-4 h-4 rounded-full bg-white transition-transform ' +
											(v ? 'translate-x-[18px]' : 'translate-x-0.5')}
										style="box-shadow: 0 1px 2px rgba(0,0,0,0.25);"
									></span>
								</span>
							</button>
						{/each}
					</div>

					<div class="px-6 pb-3 text-[11.5px] font-mono text-ink-600">
						Die Schülergeräte müssen mit dem WLAN verbunden sein.
					</div>

					<div
						class="p-5 border-t border-ink-200 flex items-center justify-between gap-3 flex-wrap"
					>
						<Button variant="ghost" size="md" onclick={onClose}>Schließen</Button>
						<div class="flex items-center gap-2">
							<Button variant="secondary" size="md">QR herunterladen (PNG)</Button>
							<Button
								variant="primary"
								size="md"
								onclick={() => (fullscreen = true)}
							>
								Vollbild starten →
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}
