<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { setContext } from 'svelte';
	import { CLASSES } from '$lib/teacher-data';
	import TeacherNav from '$lib/components/TeacherNav.svelte';
	import EmailShareModal from '$lib/components/EmailShareModal.svelte';
	import QRShareModal from '$lib/components/QRShareModal.svelte';
	import StudentRowDrawer from '$lib/components/StudentRowDrawer.svelte';

	let { children } = $props();

	let classId = $derived(page.params.class);
	let cls = $derived(CLASSES.find((c) => c.id === classId));

	let shareKind = $state<'email' | 'qr' | null>(null);

	// Drawer state driven by ?student= query param so the URL is shareable.
	let studentParam = $derived(page.url.searchParams.get('student'));
	let focusParam = $derived(page.url.searchParams.get('lesson'));
	let drawerOpen = $derived(!!studentParam && !!cls);

	function closeDrawer() {
		const url = new URL(page.url);
		url.searchParams.delete('student');
		url.searchParams.delete('lesson');
		goto(url.pathname + (url.search ? url.search : ''), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function openShare(kind: 'email' | 'qr') {
		shareKind = kind;
	}

	// Allow descendant pages to trigger share modals via context.
	setContext('teach:openShare', openShare);
</script>

<TeacherNav {classId} />

{#if cls}
	{@render children()}

	<EmailShareModal
		open={shareKind === 'email'}
		{cls}
		onClose={() => (shareKind = null)}
	/>
	<QRShareModal
		open={shareKind === 'qr'}
		{cls}
		onClose={() => (shareKind = null)}
	/>
	<StudentRowDrawer
		open={drawerOpen}
		{cls}
		studentId={studentParam}
		focusLessonId={focusParam}
		onClose={closeDrawer}
	/>
{:else}
	<div class="max-w-[1280px] mx-auto px-6 py-20 text-center">
		<div
			class="text-[12px] font-mono uppercase tracking-[0.16em] text-ink-600"
		>
			Klasse nicht gefunden
		</div>
		<h1 class="mt-2 text-[24px] font-semibold tracking-tight text-ink-900">
			Diese Klasse existiert nicht.
		</h1>
		<a href="/teach" class="mt-4 inline-block text-accent font-medium hover:underline">
			← Alle Klassen
		</a>
	</div>
{/if}
