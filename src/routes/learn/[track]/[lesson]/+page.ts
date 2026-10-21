import { error } from '@sveltejs/kit';
import { LESSONS } from '$lib/tabula/lessons';

export function load({ params }) {
	if (!LESSONS[params.lesson]) error(404, 'Diese Lektion gibt es noch nicht.');
	return {};
}
