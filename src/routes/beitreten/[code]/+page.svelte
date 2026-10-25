<script lang="ts">
	// QR-Code an der Tafel: /beitreten/<klassencode>, Code ist vorausgefüllt
	import { page } from '$app/state';
	import JoinClass from '$lib/tabula/JoinClass.svelte';
</script>

<JoinClass initialCode={decodeURIComponent(page.params.code ?? '')} />
