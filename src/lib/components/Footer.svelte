<script lang="ts">
	import Logo from './Logo.svelte';
	import Icon from './Icon.svelte';
</script>

<footer class="border-t border-ink-200">
	<div
		class="max-w-[1280px] mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
	>
		<div class="flex items-center gap-5">
			<Logo size={13} />
			<span class="text-[12px] text-ink-600 font-mono">© 2026 · made by Muri</span>
		</div>
		<div class="flex items-center gap-5 text-[12.5px] text-ink-700">
			<a
				href="https://github.com"
				class="inline-flex items-center gap-1.5 hover:text-ink-900"
			>
				<Icon name="github" size={13} /> github.com/muri/sbsqltt
			</a>
			<a href="#" class="inline-flex items-center gap-1.5 hover:text-ink-900">
				<span
					class="font-mono px-1.5 h-5 inline-flex items-center rounded border border-ink-300 text-[10.5px] text-ink-700"
					>AGPL-3.0</span
				>
				license
			</a>
			<a href="https://jmestudio.de" class="hover:text-ink-900">jmestudio.de</a>
		</div>
	</div>
</footer>
