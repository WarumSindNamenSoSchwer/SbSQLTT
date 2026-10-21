<script lang="ts">
	// Startseite v11: Markup, CSS und Verhalten 1:1 aus der Designer-Lieferung.
	// Quelle: docs/design (Website v11). Neu erzeugen statt von Hand aendern.
	import { onMount } from 'svelte';
	import html from '$lib/landing/v11.html?raw';
	import css from '$lib/landing/v11.css?raw';
	import G from '$lib/edgar/owl-gen.js';

	onMount(() => {
		const root = document.documentElement;
		const sync = () => (root.dataset.theme = root.classList.contains('light') ? 'light' : 'dark');
		sync();
		root.lang = 'de';
		const cleanups: (() => void)[] = [];

		// Theme-Schalter der Seite mit dem App-Theme (html.light, localStorage) verbinden
		const themeMo = new MutationObserver(() => {
			const dark = root.dataset.theme === 'dark';
			if (root.classList.contains('light') === dark) {
				root.classList.toggle('light', !dark);
				root.classList.toggle('dark', dark);
				try {
					localStorage.setItem('sbsqltt-theme', dark ? 'dark' : 'light');
				} catch {
					/* ignore */
				}
			}
			paint();
		});
		themeMo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
		cleanups.push(() => themeMo.disconnect());

		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		function paint() {
			const dark = root.dataset.theme === 'dark';
			document.querySelectorAll<HTMLElement>('.landing [data-owl]').forEach((el) => {
				const key = el.getAttribute('data-owl') || 'idle';
				const d = dark || el.getAttribute('data-owl-dark') === '1';
				const hover = el.getAttribute('data-owl-mode') === 'hover';
				if (hover && !el.dataset.bound) {
					el.dataset.bound = '1';
					const host = el.closest('.owl-role') || el;
					host.addEventListener('mouseenter', () => { el.dataset.state = 'loop'; paint(); });
					host.addEventListener('mouseleave', () => { el.dataset.state = 'static'; paint(); });
					new IntersectionObserver((es, io) => es.forEach((e) => { if (e.isIntersecting) { el.dataset.state = 'once'; paint(); io.disconnect(); } }), { threshold: 0.4 }).observe(el);
				}
				const state = reduce || !G.ANIMS[key] ? 'static' : hover ? el.dataset.state || 'static' : 'loop';
				const tag = key + (d ? '-d' : '') + '-' + state;
				if (el.dataset.cur === tag) return;
				const opt = d ? G.DARK : {};
				let svg = state === 'static' ? (key === 'sleep' ? G.sleep(opt) : G.owl({ ...(G.STATES[key] || {}), ...opt })) : G.animSvg(key, opt);
				if (state === 'once') svg = svg.replace(/ infinite/g, ' 2');
				el.innerHTML = svg.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
				el.dataset.cur = tag;
			});
		}
		const w = window as unknown as Record<string, unknown>;
		w.SbOwl = (el: Element | null, key: string) => {
			if (!el || el.getAttribute('data-owl') === key) return;
			el.setAttribute('data-owl', key);
			paint();
		};

		import('$lib/landing/v11-site.js').then(() => {
			(w.SbSiteInit as () => void)?.();
			const follow = (target: Element | null, opts: MutationObserverInit, owlSel: string, pick: () => string | undefined) => {
				const o = document.querySelector(owlSel);
				if (!target || !o) return;
				const go = () => { const k = pick(); if (k) (w.SbOwl as (e: Element, k: string) => void)(o, k); };
				const m = new MutationObserver(go);
				m.observe(target, opts);
				cleanups.push(() => m.disconnect());
				go();
			};
			const hero = document.querySelector<HTMLElement>('.motion-hero');
			const HK = ['read', 'thinking', 'lookaround', 'success'];
			follow(hero, { attributes: true, attributeFilter: ['data-step'] }, '.hero-owl', () => HK[+(hero?.dataset.step ?? 0)] || 'idle');
			const hOwl = document.querySelector<HTMLElement>('.hero-owl');
			if (hOwl) {
				const onMove = (e: PointerEvent) => {
					const p = hOwl.querySelector<SVGElement>('.pupils');
					if (!p) return;
					const r = hOwl.getBoundingClientRect();
					const dx = e.clientX - (r.left + r.width * 0.47), dy = e.clientY - (r.top + r.height * 0.43);
					const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 240);
					p.style.transition = 'transform .12s';
					p.style.transform = 'translate(' + ((dx / d) * 4 * k).toFixed(2) + 'px,' + ((dy / d) * 4 * k).toFixed(2) + 'px)';
				};
				window.addEventListener('pointermove', onMove, { passive: true });
				cleanups.push(() => window.removeEventListener('pointermove', onMove));
			}
			const jv = document.querySelector<HTMLElement>('.j-visual');
			const JK = ['curious', 'thinking', 'success'];
			follow(jv, { attributes: true, attributeFilter: ['data-phase'] }, '.j-owl', () => JK[+(jv?.dataset.phase ?? 0)]);
			const tv = document.querySelector<HTMLElement>('.t-visual');
			const TK = ['wave', 'lookaround', 'hint', 'quiz'];
			follow(tv, { attributes: true, attributeFilter: ['data-t-phase'] }, '.t-owl', () => TK[+(tv?.dataset.tPhase ?? 0)]);
			const fb = document.getElementById('feedback');
			const fo = document.querySelector<HTMLElement>('.fb-owl');
			follow(fb, { attributes: true, childList: true, characterData: true, subtree: true }, '.fb-owl', () => {
				if (fo && fb) fo.hidden = fb.hidden;
				return fb?.classList.contains('error') ? 'error' : /Richtig/.test(fb?.textContent || '') ? 'celebrate' : 'thinking';
			});
			paint();
		});
		paint();
		return () => {
			cleanups.forEach((f) => f());
			delete root.dataset.theme;
		};
	});
</script>

<svelte:head>
	<title>Tabula · SQL im Informatikunterricht, kostenlos im Browser</title>
	{@html `<style>${css}</style>`}
</svelte:head>

<div class="landing">{@html html}</div>
