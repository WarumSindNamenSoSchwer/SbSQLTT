import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Statisch (SPA-Fallback). Laeuft hinter Caddy auf dem eigenen Server.
		adapter: adapter({ fallback: '200.html' })
	}
};

export default config;
