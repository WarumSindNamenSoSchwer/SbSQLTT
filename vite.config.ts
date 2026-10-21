import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 5194,
		proxy: {
			// Kontaktformular-Dienst: MUSS vor /api stehen
			'/api/contact': {
				target: 'http://localhost:3001',
				changeOrigin: true,
			},
			'/api': {
				target: 'http://localhost:3005',
				changeOrigin: true,
			},
		},
	},
});
