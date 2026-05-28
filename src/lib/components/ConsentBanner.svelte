<script lang="ts">
	import { onMount } from 'svelte';
	import Button from './Button.svelte';

	const STORAGE_KEY = 'sbsqltt-consent';

	let visible = $state(false);

	onMount(() => {
		try {
			if (!localStorage.getItem(STORAGE_KEY)) {
				visible = true;
			}
		} catch {
			// localStorage may be unavailable (e.g. SSR safety, private modes) —
			// in that case we simply don't show the banner.
			visible = false;
		}
	});

	function acknowledge() {
		try {
			localStorage.setItem(STORAGE_KEY, 'ack-' + new Date().toISOString());
		} catch {
			// ignore — still hide the banner for this session
		}
		visible = false;
	}
</script>

{#if visible}
	<div
		role="region"
		aria-label="Cookie- und Datenschutzhinweis"
		class="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 sm:pb-6 pointer-events-none"
	>
		<div
			class="mx-auto max-w-[720px] pointer-events-auto bg-ink-50/95 backdrop border border-ink-200 shadow-pop rounded-lg p-4 sm:p-5 fade-in"
		>
			<div class="flex flex-col sm:flex-row sm:items-center gap-4">
				<p
					class="text-[13px] leading-relaxed text-ink-700 flex-1"
					style="text-wrap: pretty"
				>
					Diese Seite verwendet ausschließlich technisch notwendige Cookies. Tracking
					findet nicht statt. Mehr Infos in der
					<a
						href="/datenschutz"
						class="text-accent hover:underline underline-offset-4 font-medium"
						>Datenschutzerklärung</a
					>.
				</p>
				<div class="flex items-center gap-2 shrink-0">
					<a
						href="/datenschutz"
						class="text-[13px] px-3 h-8 inline-flex items-center rounded-md text-ink-700 hover:text-ink-900 hover:bg-ink-100 ring-accent"
					>
						Datenschutz
					</a>
					<Button variant="primary" size="sm" onclick={acknowledge}>Verstanden</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
