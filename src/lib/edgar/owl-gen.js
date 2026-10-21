// Edgar, die Eule. Generator vom Designer (owl-gen.js v4), als ES-Modul.
// @ts-nocheck
// SbSQLTT Eule — Generator v4: getrennte Ohren, animierbare Gruppen, 23 Posen, 24 Animationen.
// Koordinaten in Referenz-Pixeln (Mittelachse x=108). Klassen für Animation:
// .owl (ganze Figur) · .head (Kopf inkl. Ohren, Gesicht, Brille) · .ear-l/.ear-r · .eyes · .pupils · .wing-l/.wing-r · .prop-*
const INK = '#0F172A', BLUE = '#3B82F6', W = '#FFFFFF', SLATE2 = '#E2E8F0', SLATE6 = '#475569';
const VB = '14 44 200 180';
const HEAD = 'M58 112 Q56 94 70 87 Q88 80 108 80 Q128 80 146 87 Q160 94 158 112 C163 120 166 130 164 140 C162 155 152 166 140 174 L76 174 C64 166 54 155 52 140 C50 130 53 120 58 112 Z';
const EAR_L = 'M57 114 Q52 98 53 82 Q70 82 86 90 Q92 104 82 118 Z';
const EAR_R = 'M159 114 Q164 98 163 82 Q146 82 130 90 Q124 104 134 118 Z';
const EAR_PIVOT = { l: [68, 104], r: [148, 104] };
const EGG = 'M0 -26 C10 -26 17 -14 17 0 C17 15 9 26 0 26 C-9 26 -17 15 -17 0 C-17 -14 -10 -26 0 -26 Z';
const FOOT = 'M0 0 C5 0 9 2 12 5 C14 7 13 9 11 8.5 L7 7 C7.5 10 6.5 12 4.5 12 C2.5 12 1.5 9.5 0 7 C-1.5 9.5 -2.5 12 -4.5 12 C-6.5 12 -7.5 10 -7 7 L-11 8.5 C-13 9 -14 7 -12 5 C-9 2 -5 0 0 0 Z';
const BEAK = 'M108 132.5 Q110 132.5 111.5 134.5 L115 138.5 Q116.5 140.5 115.2 142.5 L110 148 Q108 150 106 148 L100.8 142.5 Q99.5 140.5 101 138.5 L104.5 134.5 Q106 132.5 108 132.5 Z';
const L = 88, R = 128, EY = 122, LR = 18;
const FONT = 'system-ui,-apple-system,sans-serif', MONO = 'ui-monospace,Menlo,monospace';

// Flügel = Ei [cx, cy, rot, scale]; Drehpunkt = Ende, das näher am Körper liegt
const WINGS = {
  down: [[68, 170, 12], [148, 170, -12]],
  up: [[50, 150, -35], [166, 150, 35]],
  out: [[58, 164, 30], [158, 164, -30]],
  waveL: [[50, 150, -35], [148, 170, -12]],
  chinR: [[68, 170, 12], [130, 172, -35, 1.08]],
  quiz: [[88, 172, 35, 1.02], [148, 170, -12]],
  card: [[66, 174, -8, 0.95], [150, 174, 8, 0.95]],
  raiseR: [[68, 170, 12], [164, 116, 10, 1.1]],
  pointR: [[68, 170, 12], [172, 150, 72]],
  hug: [[74, 170, 30], [142, 170, -30]],
};
const end = (cx, cy, rot, k = 1, sgn = 1) => { const a = rot * Math.PI / 180; return [cx + sgn * 26 * k * Math.sin(a), cy - sgn * 26 * k * Math.cos(a)]; };
function wingPivot([cx, cy, rot, k = 1]) {
  const a = end(cx, cy, rot, k, 1), b = end(cx, cy, rot, k, -1);
  const d = p => (p[0] - 108) ** 2 + (p[1] - 150) ** 2;
  return (d(a) < d(b) ? a : b).map(v => +v.toFixed(1));
}
const eggPath = ([cx, cy, rot, k = 1]) => `<path d="${EGG}" transform="translate(${cx} ${cy}) rotate(${rot}) scale(${k})"/>`;
const grp = (cls, inner, origin, extra = '') => `<g class="${cls}"${origin ? ` style="transform-origin:${origin[0]}px ${origin[1]}px"` : ''}${extra}>${inner}</g>`;

function eyesSvg(kind, line) {
  const arc = d => `<g fill="none" stroke="${line}" stroke-width="3.6" stroke-linecap="round">${d}</g>`;
  const pup = (dx = 0, dy = 1, r = 7, r2 = r) => `<g class="pupils"><circle cx="${L + dx}" cy="${EY + dy}" r="${r}" fill="${line}"/><circle cx="${R + dx}" cy="${EY + dy}" r="${r2}" fill="${line}"/></g>`;
  const happyL = `<path d="M${L - 9} 125 Q${L} 113 ${L + 9} 125"/>`, happyR = `<path d="M${R - 9} 125 Q${R} 113 ${R + 9} 125"/>`;
  switch (kind) {
    case 'happy': return arc(happyL + happyR);
    case 'closed': return arc(`<path d="M${L - 11} 120 Q${L} 131 ${L + 11} 120"/><path d="M${R - 11} 120 Q${R} 131 ${R + 11} 120"/>`);
    case 'look': return pup(4, -4);
    case 'down': return pup(1, 6);
    case 'side': return pup(6, 1);
    case 'wide': return pup(0, 0, 9.5) + `<circle cx="${L + 3}" cy="${EY - 3}" r="2.6" fill="${W}"/><circle cx="${R + 3}" cy="${EY - 3}" r="2.6" fill="${W}"/>`;
    case 'wink': return `<g class="pupils"><circle cx="${L}" cy="${EY + 1}" r="7" fill="${line}"/></g>` + arc(happyR);
    case 'sad': return pup(0, 5, 6.5) + arc(`<path d="M${L - 11} ${EY - 7} L${L + 10} ${EY - 12}"/><path d="M${R + 11} ${EY - 7} L${R - 10} ${EY - 12}"/>`);
    case 'worried': return pup(1, 3, 6, 7.5) + arc(`<path d="M${L - 12} ${EY - 4} L${L + 12} ${EY - 10}"/>`);
    default: return pup();
  }
}

const PROPS = {
  card: l => `<rect x="66" y="158" width="84" height="42" rx="5" fill="${W}" stroke="${l}" stroke-width="3.2"/><g fill="none" stroke="${BLUE}" stroke-width="2.6" stroke-linecap="round"><g class="prop-bulb"><path d="M88 186 Q84 181 84 178 A8 8 0 1 1 100 178 Q100 181 96 186 Z"/><path d="M88.5 192 L95.5 192"/></g><g class="prop-bulbrays"><path d="M92 163 L92 166"/><path d="M81 168 L83 170"/><path d="M103 168 L101 170"/></g><path d="M108 176 L134 176"/><path d="M108 186 L126 186"/></g>`,
  book: l => `<path d="M64 170 Q86 162 108 170 L108 200 Q86 192 64 200 Z" fill="${W}" stroke="${l}" stroke-width="3" stroke-linejoin="round"/><path d="M152 170 Q130 162 108 170 L108 200 Q130 192 152 200 Z" fill="${W}" stroke="${l}" stroke-width="3" stroke-linejoin="round"/><g stroke="${SLATE2}" stroke-width="2.4" stroke-linecap="round"><path d="M72 176 Q86 171 100 176"/><path d="M72 184 Q86 179 100 184"/><path d="M116 176 Q130 171 144 176"/><path d="M116 184 Q130 179 144 184"/></g><path d="M64 200 Q86 192 108 200 Q130 192 152 200 L152 204 Q130 196 108 204 Q86 196 64 204 Z" fill="${BLUE}" stroke="${l}" stroke-width="3" stroke-linejoin="round"/><g class="prop-page" style="transform-origin:108px 185px"><path d="M152 170 Q130 162 108 170 L108 200 Q130 192 152 200 Z" fill="${W}" stroke="${l}" stroke-width="3" stroke-linejoin="round"/><g stroke="${SLATE2}" stroke-width="2.4" stroke-linecap="round"><path d="M116 176 Q130 171 144 176"/><path d="M116 184 Q130 179 144 184"/></g></g>`,
  laptop: l => `<rect x="68" y="158" width="80" height="40" rx="5" fill="${BLUE}" stroke="${l}" stroke-width="3.2"/><text x="108" y="184" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="14" fill="${W}">&lt;/&gt;</text><rect x="58" y="198" width="100" height="7" rx="3" fill="${l}"/>`,
  trophy: l => `<g stroke="${l}" stroke-width="3" stroke-linejoin="round"><path d="M92 196 L124 196 L124 202 L92 202 Z" fill="${l}"/><path d="M104 182 L112 182 L114 196 L102 196 Z" fill="${BLUE}"/><path d="M90 158 L126 158 L124 172 Q118 184 108 184 Q98 184 92 172 Z" fill="${BLUE}"/><path d="M90 162 Q80 162 82 170 Q84 176 93 175" fill="none"/><path d="M126 162 Q136 162 134 170 Q132 176 123 175" fill="none"/></g><path d="M101 164 L101 172" stroke="${W}" stroke-width="3" stroke-linecap="round"/>`,
  timer: (l, anim) => `<rect x="140" y="160" width="58" height="32" rx="5" fill="${W}" stroke="${l}" stroke-width="3.2"/>` + (anim
    ? ['00:30', '00:29', '00:28'].map((t, i) => `<text class="t t${i + 1}" x="169" y="182.5" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="16" fill="${BLUE}">${t}</text>`).join('')
    : `<text x="169" y="182.5" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="16" fill="${BLUE}">00:30</text>`),
  sign: l => `<g transform="rotate(-14 170 160)"><rect x="140" y="142" width="60" height="38" rx="4" fill="${W}" stroke="${l}" stroke-width="3.2"/><text x="170" y="158" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="12" fill="${BLUE}">Syntax</text><text x="170" y="173" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="12" fill="${BLUE}">Error?</text></g>`,
};

function owl(o = {}) {
  const body = o.body || INK, line = o.line || INK;
  const [wl, wr] = WINGS[o.wings || 'down'];
  const ears = o.ears || [0, 0];
  const earG = side => grp(`ear-${side}`, `<g transform="rotate(${side === 'l' ? ears[0] : ears[1]} ${EAR_PIVOT[side].join(' ')})"><path d="${side === 'l' ? EAR_L : EAR_R}"/></g>`, EAR_PIVOT[side]);
  let back = '';
  const headBand = !o.headset ? '' : `<path class="prop-headband" d="M50 128 C48 86 72 64 108 64 C144 64 168 86 166 128" fill="none" stroke="${BLUE}" stroke-width="4.5" stroke-linecap="round"/>`;
  const belly = `<ellipse cx="108" cy="163" rx="38" ry="35"/>`;
  let headInner = headBand + `<g fill="${body}">${earG('l')}${earG('r')}<path d="${HEAD}"/></g>`
    + `<g fill="${W}"><circle cx="${L}" cy="${EY}" r="27.5"/><circle cx="${R}" cy="${EY}" r="27.5"/>${belly}</g>`;
  if (!o.noGlasses) headInner += `<g class="glasses" fill="none" stroke="${line}" stroke-width="3.4" stroke-linecap="round"><circle cx="${L}" cy="${EY}" r="${LR}"/><circle cx="${R}" cy="${EY}" r="${LR}"/><path d="M105.5 120 Q108 117 110.5 120"/><path d="M70 119.5 L62 118"/><path d="M146 119.5 L154 118"/></g>`;
  headInner += grp('eyes', eyesSvg(o.eyes, line), [108, EY]);
  headInner += `<path class="beak" d="${BEAK}" fill="${BLUE}"/>`;
  if (o.tear) headInner += `<path class="prop-tear" d="M${L - 8} ${EY + 14} Q${L - 12} ${EY + 21} ${L - 8} ${EY + 24} Q${L - 4} ${EY + 21} ${L - 8} ${EY + 14} Z" fill="${BLUE}"/>`;
  if (o.sweat) headInner += `<path class="prop-sweat" d="M48 96 Q42 106 45 111 Q48 115 52 111 Q55 106 48 96 Z" fill="${BLUE}" stroke="${line}" stroke-width="2" stroke-linejoin="round" style="transform-box:fill-box;transform-origin:50% 0%"/>`;
  if (o.cap) headInner += `<g class="prop-cap"><path d="M84 80 L132 80 L130 92 Q108 86 86 92 Z" fill="${line}"/><path d="M108 60 L152 74 L108 88 L64 74 Z" fill="${line}"/><path d="M108 74 L146 78 L148 98" fill="none" stroke="${BLUE}" stroke-width="2.6" stroke-linecap="round"/><rect x="145" y="96" width="6" height="9" rx="2" fill="${BLUE}"/></g>`;
  let s = back;
  s += `<g fill="${body}"><g class="feet"><path transform="translate(90 203)" d="${FOOT}"/><path transform="translate(126 203)" d="${FOOT}"/></g><ellipse cx="108" cy="168" rx="44" ry="38"/></g>`;
  s += `<g fill="${W}">${belly}</g>`;
  if (o.headset) headInner += `<g class="prop-headset"><g fill="${BLUE}"><rect x="43" y="110" width="12" height="30" rx="5.5"/><rect x="161" y="110" width="12" height="30" rx="5.5"/></g><path d="M49 140 Q52 150 82 148" fill="none" stroke="${line}" stroke-width="2.6" stroke-linecap="round"/><circle cx="84" cy="148" r="3.2" fill="${line}"/></g>`;
  let head = grp('head', headInner, [108, 160]);
  if (o.headTilt) head = `<g transform="rotate(${o.headTilt} 108 160)">${head}</g>`;
  s += head;
  s += `<g fill="${body}">${grp('wing-l', eggPath(wl), wingPivot(wl))}${grp('wing-r', eggPath(wr), wingPivot(wr))}</g>`;
  for (const p of ['card', 'book', 'laptop', 'trophy']) if (o[p]) s += `<g class="prop-${p}">${PROPS[p](line)}</g>`;
  if (o.hold) s += `<g fill="${body}" class="hands">${grp('hand-l', eggPath([66, 182, -30, 0.5]), [60, 192])}${grp('hand-r', eggPath([150, 182, 30, 0.5]), [156, 192])}</g>`;
  if (o.timer) s += `<g class="prop-timer">${PROPS.timer(line, o.anim)}</g>`;
  if (o.sign) s += `<g class="prop-sign" style="transform-origin:150px 190px">${PROPS.sign(line)}${o.signWing ? `<g fill="${body}" class="sign-hand">${eggPath([146, 184, -150, 0.62])}</g>` : ''}</g>`;
  let front = '';
  const star = (x, y, k, c = '') => `<g transform="translate(${x} ${y}) scale(${k})"><path class="${c}" d="M0 -9 Q1.6 -1.6 9 0 Q1.6 1.6 0 9 Q-1.6 1.6 -9 0 Q-1.6 -1.6 0 -9 Z" style="transform-box:fill-box;transform-origin:center"/></g>`;
  if (o.q) front += `<text class="prop-q" x="${o.q[0]}" y="${o.q[1]}" font-family="${FONT}" font-weight="800" font-size="34" fill="${BLUE}" style="transform-box:fill-box;transform-origin:50% 100%">?</text>`;
  if (o.bang) front += `<text class="prop-bang" x="180" y="104" font-family="${FONT}" font-weight="800" font-size="36" fill="${BLUE}" style="transform-box:fill-box;transform-origin:50% 100%">!</text>`;
  if (o.spark) front += `<g class="prop-sparkles" fill="${BLUE}">${star(30, 92, 1, 's1')}${star(186, 92, 1, 's2')}${o.spark > 1 ? star(42, 64, 0.6, 's3') + star(176, 62, 0.6, 's4') : ''}</g>`;
  if (o.rays) front += `<g class="prop-rays" stroke="${BLUE}" stroke-width="3.6" stroke-linecap="round"><path d="M176 92 L183 82"/><path d="M180 106 L190 102"/></g>`;
  if (o.arrow) front += `<g class="prop-arrow" fill="none" stroke="${BLUE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M196 168 L196 120"/><path d="M187 130 L196 119 L205 130"/></g>`;
  if (o.dots) front += `<g class="prop-dots" fill="${BLUE}"><circle class="d1" cx="164" cy="92" r="4.5"/><circle class="d2" cx="178" cy="92" r="4.5"/><circle class="d3" cx="192" cy="92" r="4.5"/></g>`;
  if (o.heart) front += `<path class="prop-heart" d="M172 100 C160 90 158 80 166 76 C170 74 172 78 172 80 C172 78 174 74 178 76 C186 80 184 90 172 100 Z" fill="${BLUE}" style="transform-box:fill-box;transform-origin:50% 100%"/>`;
  if (o.confetti) { const C = [[34, 70, BLUE, 20], [52, 56, INK, -30], [176, 60, BLUE, 40], [192, 82, SLATE6, -15], [28, 104, SLATE6, 60], [196, 120, BLUE, 10], [70, 50, BLUE, 70], [150, 50, INK, -50]]; front += `<g class="prop-confetti">${C.map(([x, y, c, r], i) => `<rect class="c${i % 4 + 1}" x="${x}" y="${y}" width="7" height="4" rx="1" fill="${c}" transform="rotate(${r} ${x + 3.5} ${y + 2})"/>`).join('')}</g>`; }
  let g = grp('owl', s, [108, 212]);
  if (o.tilt) g = `<g transform="rotate(${o.tilt} 108 180)">${g}</g>`;
  if (o.lift) g = `<g transform="translate(0 ${o.lift})">${g}</g>`;
  if (o.books) g = `<g class="prop-books" stroke="${line}" stroke-width="3.2" stroke-linejoin="round"><rect x="44" y="204" width="128" height="16" rx="4" fill="${W}"/><rect x="52" y="188" width="116" height="16" rx="4" fill="${BLUE}"/><path d="M54 212 L164 212" stroke-width="2"/></g>` + g;
  const css = o.css ? `<style>${o.css}</style>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg"${o.id ? ` id="${o.id}"` : ''} viewBox="${VB}">${css}${g}${front}</svg>`;
}

function sleep(o = {}) {
  const body = o.body || INK, line = o.line || INK;
  const z = [[152, 112, 16, 'z'], [166, 100, 21, 'Z'], [182, 86, 27, 'Z']].map(([x, y, s, t], i) => `<text class="z z${i + 1}" x="${x}" y="${y}" font-size="${s}" style="transform-box:fill-box;transform-origin:center">${t}</text>`).join('');
  const earG = side => grp(`ear-${side}`, `<path d="${side === 'l' ? EAR_L : EAR_R}"/>`, EAR_PIVOT[side]);
  return `<svg xmlns="http://www.w3.org/2000/svg"${o.id ? ` id="${o.id}"` : ''} viewBox="${VB}">${o.css ? `<style>${o.css}</style>` : ''}
  <g transform="translate(108 176) scale(0.86) translate(-108 -150)">${grp('head', `<g fill="${body}">${earG('l')}${earG('r')}<path d="${HEAD}"/></g>
    <g fill="${W}"><circle cx="${L}" cy="${EY}" r="27.5"/><circle cx="${R}" cy="${EY}" r="27.5"/><ellipse cx="108" cy="150" rx="30" ry="16"/></g>
    ${grp('eyes', eyesSvg('closed', line), [108, EY])}<path d="${BEAK}" fill="${BLUE}"/>`, [108, 172])}</g>
  <g class="prop-book" stroke="${line}" stroke-width="3.2" stroke-linejoin="round"><rect x="32" y="176" width="156" height="34" rx="8" fill="${BLUE}"/><rect x="146" y="182" width="40" height="22" rx="4" fill="${W}" stroke-width="2.6"/><path d="M152 189 L180 189" stroke-width="2" stroke="#94A3B8"/><path d="M152 197 L176 197" stroke-width="2" stroke="#94A3B8"/></g>
  <g fill="${body}">${grp('wing-l', eggPath([70, 180, 70, 0.8]), [92, 186])}</g>
  <g class="prop-zzz" font-family="${FONT}" font-weight="800" fill="${BLUE}">${z}</g>
</svg>`;
}

// Kopf-Icon: 'full' = Brille + Pupillen (ab 32 px) · 'tiny' = geformte Augen (unter 32 px)
function icon(o = {}) {
  const body = o.body || INK, line = o.line || INK, beak = o.mono ? body : BLUE, v = o.v || 'full';
  const lens = `<g fill="none" stroke="${line}" stroke-width="4.2"><circle cx="${L}" cy="${EY}" r="${LR}"/><circle cx="${R}" cy="${EY}" r="${LR}"/><path d="M105 120 Q108 116 111 120" stroke-linecap="round"/></g>`;
  const eye = cx => `<ellipse cx="${cx}" cy="${EY + 1}" rx="10.5" ry="12.5" fill="${line}"/><circle cx="${cx + 3.5}" cy="${EY - 4}" r="3.6" fill="${W}"/>`;
  const eyes = v === 'tiny' ? eye(L + 1) + eye(R - 1) : lens + `<circle cx="${L}" cy="${EY + 1}" r="7" fill="${line}"/><circle cx="${R}" cy="${EY + 1}" r="7" fill="${line}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="46 70 124 108">
  <g fill="${body}"><path d="${EAR_L}"/><path d="${EAR_R}"/><path d="${HEAD}"/></g>
  <g fill="${W}"><circle cx="${L}" cy="${EY}" r="27.5"/><circle cx="${R}" cy="${EY}" r="27.5"/><ellipse cx="108" cy="146" rx="22" ry="12"/></g>
  ${eyes}<path d="${BEAK}" fill="${beak}"/></svg>`;
}

const STATES = {
  idle: {},
  blink: { eyes: 'happy' },
  thinking: { eyes: 'look', tilt: -5, wings: 'chinR', q: [160, 96], ears: [-6, 4] },
  success: { eyes: 'happy', wings: 'up', spark: 1, lift: -4, ears: [6, -6] },
  error: { eyes: 'worried', tilt: 3, sign: true, signWing: true, q: [168, 120], ears: [-14, 6], sweat: true },
  hint: { card: true, hold: true, wings: 'card', rays: true, ears: [6, -6] },
  quiz: { headset: true, timer: true, rays: true, wings: 'quiz' },
  wave: { eyes: 'happy', wings: 'waveL' },
  levelup: { eyes: 'happy', books: true, lift: -20, wings: 'waveL', arrow: true, ears: [6, -6] },
  wink: { eyes: 'wink', wings: 'out', ears: [0, -8] },
  surprised: { eyes: 'wide', wings: 'out', ears: [10, -10] },
  sad: { eyes: 'sad', ears: [-16, 16], tear: true, wings: 'hug', headTilt: 4 },
  curious: { eyes: 'side', headTilt: 10, ears: [6, -8] },
  point: { eyes: 'side', wings: 'pointR', ears: [4, -6] },
  read: { eyes: 'down', book: true, hold: true, wings: 'card', headTilt: -4 },
  laptop: { eyes: 'down', laptop: true, hold: true, wings: 'card' },
  trophy: { eyes: 'happy', trophy: true, hold: true, wings: 'card', spark: 2, ears: [6, -6] },
  loading: { eyes: 'look', dots: true, ears: [0, -6] },
  celebrate: { eyes: 'happy', wings: 'up', confetti: true, lift: -6, ears: [8, -8] },
  heart: { eyes: 'happy', wings: 'hug', heart: true, ears: [6, -6] },
  graduate: { eyes: 'happy', cap: true, wings: 'out' },
  raisehand: { eyes: 'open', wings: 'raiseR', ears: [4, -8] },
};

// Animationen: jede Datei = eine Pose + CSS-Keyframes. Ohren bewegen sich in jeder Animation mit.
const E = 'cubic-bezier(.45,0,.55,1)';
const earsCss = (name, dur, kf, delay = 0) => `.ear-l{animation:${name}L ${dur}s ${E} ${delay}s infinite}.ear-r{animation:${name}R ${dur}s ${E} ${delay}s infinite}@keyframes ${name}L{${kf(1)}}@keyframes ${name}R{${kf(-1)}}`;
const blinkCss = (dur = 4) => `.eyes{animation:blink ${dur}s infinite}@keyframes blink{0%,46%,54%,100%{transform:scaleY(1)}50%{transform:scaleY(.1)}}`;
const ANIMS = {
  idle: [{}, `.owl{animation:breathe 3.2s ${E} infinite}@keyframes breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.012,.988)}}` + blinkCss(4.8) + earsCss('tw', 4.8, s => `0%,70%,82%,100%{transform:rotate(0)}74%{transform:rotate(${-10 * s}deg)}78%{transform:rotate(${4 * s}deg)}`)],
  blink: [{}, blinkCss(2.4) + earsCss('fl', 2.4, s => `0%,44%,60%,100%{transform:rotate(0)}50%{transform:rotate(${-7 * s}deg)}`)],
  lookaround: [{}, `.pupils{animation:look 4s ${E} infinite}@keyframes look{0%,10%,90%,100%{transform:translateX(0)}25%,40%{transform:translateX(-5px)}60%,75%{transform:translateX(5px)}}.head{animation:turn 4s ${E} infinite}@keyframes turn{0%,10%,90%,100%{transform:rotate(0)}25%,40%{transform:rotate(-4deg)}60%,75%{transform:rotate(4deg)}}` + earsCss('lk', 4, s => `0%,10%,90%,100%{transform:rotate(0)}25%,40%{transform:rotate(${8 * s}deg)}60%,75%{transform:rotate(${-8 * s}deg)}`)],
  thinking: [STATES.thinking, `.head{animation:ponder 3s ${E} infinite}@keyframes ponder{0%,100%{transform:rotate(0)}50%{transform:rotate(-5deg)}}.prop-q{animation:qbob 1.5s ${E} infinite}@keyframes qbob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-5px) rotate(8deg)}}.wing-r{animation:tap 1.5s ${E} infinite}@keyframes tap{0%,100%{transform:rotate(0)}50%{transform:rotate(-6deg)}}` + earsCss('th', 3, s => `0%,100%{transform:rotate(0)}50%{transform:rotate(${(s > 0 ? -12 : 6) * s}deg)}`)],
  success: [{ ...STATES.success, spark: 2 }, `.owl{animation:jump .9s ${E} infinite}@keyframes jump{0%,100%{transform:translateY(0) scale(1.03,.97)}15%{transform:translateY(0) scale(.97,1.03)}50%{transform:translateY(-14px) scale(1)}85%{transform:translateY(0) scale(1)}}.wing-l{animation:flapL .45s ${E} infinite alternate}.wing-r{animation:flapR .45s ${E} infinite alternate}@keyframes flapL{to{transform:rotate(-18deg)}}@keyframes flapR{to{transform:rotate(18deg)}}.prop-sparkles path{animation:tw .9s ${E} infinite}.prop-sparkles .s2{animation-delay:.45s}.prop-sparkles .s3{animation-delay:.22s}.prop-sparkles .s4{animation-delay:.67s}@keyframes tw{0%,100%{transform:scale(.3) rotate(0);opacity:.3}50%{transform:scale(1.25) rotate(45deg);opacity:1}}` + earsCss('jp', .9, s => `0%,100%{transform:rotate(0)}50%{transform:rotate(${-12 * s}deg)}85%{transform:rotate(${6 * s}deg)}`)],
  error: [STATES.error, `.owl{animation:recoil 4s ${E} infinite}@keyframes recoil{0%,8%{transform:translate(0,0) rotate(0)}12%{transform:translate(-5px,2px) rotate(-6deg) scale(1.02,.97)}16%{transform:translate(-2px,-6px) rotate(-2deg) scale(.98,1.03)}22%{transform:translate(0,0) rotate(0)}26%{transform:translate(0,-3px)}30%,82%{transform:translate(0,0) rotate(0)}88%{transform:translate(0,-2px) rotate(1deg)}100%{transform:none}}.prop-sign{animation:signpop 4s ${E} infinite}@keyframes signpop{0%,6%{transform:translateY(14px) rotate(6deg) scale(.86)}12%{transform:translateY(-10px) rotate(-8deg) scale(1.08)}16%{transform:translateY(-4px) rotate(7deg) scale(1)}19%{transform:translateY(-4px) rotate(-6deg)}22%{transform:translateY(-4px) rotate(5deg)}25%{transform:translateY(-4px) rotate(-3deg)}28%,60%{transform:translateY(-2px) rotate(0)}64%{transform:translateY(0) rotate(4deg)}68%{transform:translateY(0) rotate(-2deg)}72%,92%{transform:translateY(2px) rotate(0)}100%{transform:translateY(14px) rotate(6deg) scale(.86)}}.prop-q{animation:qpop 4s ${E} infinite}@keyframes qpop{0%,14%{transform:scale(0) rotate(-30deg);opacity:0}20%{transform:scale(1.35) rotate(12deg);opacity:1}25%{transform:scale(.9) rotate(-8deg)}30%{transform:scale(1) rotate(0)}44%{transform:translateY(-4px) rotate(10deg)}52%{transform:translateY(0) rotate(-6deg)}60%,86%{transform:rotate(0);opacity:1}94%,100%{transform:scale(0);opacity:0}}.eyes{animation:startle 4s ${E} infinite}@keyframes startle{0%,9%{transform:scale(1)}13%,20%{transform:scale(1.18)}28%,100%{transform:scale(1)}}.pupils{animation:peek 4s ${E} infinite}@keyframes peek{0%,30%{transform:translate(0,0)}36%,58%{transform:translate(3px,2px)}64%,72%{transform:translate(-3px,-5px)}80%,100%{transform:translate(0,0)}}.head{animation:headlook 4s ${E} infinite}@keyframes headlook{0%,30%{transform:rotate(0)}38%,58%{transform:rotate(7deg)}66%,80%{transform:rotate(-4deg)}90%,100%{transform:rotate(0)}}.wing-l{animation:scratch 4s ${E} infinite}@keyframes scratch{0%,60%{transform:translate(0,0) rotate(0) scale(1)}67%{transform:translate(-16px,-12px) rotate(160deg) scale(.7,.85)}70%{transform:translate(-16px,-12px) rotate(150deg) scale(.7,.85)}73%{transform:translate(-16px,-12px) rotate(164deg) scale(.7,.85)}76%{transform:translate(-16px,-12px) rotate(150deg) scale(.7,.85)}79%{transform:translate(-16px,-12px) rotate(160deg) scale(.7,.85)}86%,100%{transform:translate(0,0) rotate(0) scale(1)}}.prop-sweat{opacity:0;animation:sweat 4s ease-in infinite}@keyframes sweat{0%,34%{opacity:0;transform:translateY(-4px) scale(.4)}40%{opacity:1;transform:translateY(0) scale(1)}58%{opacity:1;transform:translateY(10px) scale(1,1.1)}66%,100%{opacity:0;transform:translateY(22px) scale(.8)}}` + earsCss('er', 4, s => `0%,8%{transform:rotate(0)}13%{transform:rotate(${16 * s}deg)}18%{transform:rotate(${6 * s}deg)}24%{transform:rotate(${10 * s}deg)}36%,58%{transform:rotate(${-14 * s}deg)}62%{transform:rotate(${-8 * s}deg)}66%{transform:rotate(${-16 * s}deg)}74%{transform:rotate(${(s > 0 ? 10 : -6)}deg)}86%,100%{transform:rotate(0)}`)],
  hint: [STATES.hint, `.prop-card,.hands{animation:pulse 1.6s ${E} infinite;transform-origin:108px 200px}@keyframes pulse{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}.prop-bulbrays,.prop-rays{animation:flash 1.6s infinite}@keyframes flash{0%,100%{opacity:1}50%{opacity:.15}}` + earsCss('pk', 1.6, s => `0%,100%{transform:rotate(0)}50%{transform:rotate(${8 * s}deg)}`)],
  quiz: [{ ...STATES.quiz, anim: true }, `.t{opacity:0;animation:tick 3s steps(1) infinite}.t1{animation-delay:0s}.t2{animation-delay:-2s}.t3{animation-delay:-1s}@keyframes tick{0%{opacity:1}33.33%,100%{opacity:0}}.head{animation:bop .5s ${E} infinite alternate}@keyframes bop{to{transform:rotate(3deg)}}.prop-rays{animation:flash 1s infinite}@keyframes flash{0%,100%{opacity:1}50%{opacity:.2}}` + earsCss('qz', 1, s => `0%,100%{transform:rotate(0)}50%{transform:rotate(${-8 * s}deg)}`)],
  sleep: [null, `.head{animation:sbreath 3.6s ${E} infinite}@keyframes sbreath{0%,100%{transform:scale(1)}50%{transform:scale(1.02,.98)}}.z{opacity:0;animation:zz 3.6s ${E} infinite}.z2{animation-delay:1.2s}.z3{animation-delay:2.4s}@keyframes zz{0%{opacity:0;transform:translate(-6px,8px) scale(.6)}25%{opacity:1}100%{opacity:0;transform:translate(6px,-12px) scale(1.1)}}` + earsCss('sl', 3.6, s => `0%,100%{transform:rotate(${-4 * s}deg)}50%{transform:rotate(${-12 * s}deg)}`)],
  wave: [STATES.wave, `.wing-l{animation:waveW .5s ${E} infinite alternate}@keyframes waveW{from{transform:rotate(-10deg)}to{transform:rotate(22deg)}}.head{animation:nod 1s ${E} infinite alternate}@keyframes nod{to{transform:rotate(-3deg)}}` + earsCss('wv', 1, s => `0%,100%{transform:rotate(0)}50%{transform:rotate(${-9 * s}deg)}`)],
  levelup: [{ ...STATES.levelup, spark: 2 }, `.owl{animation:lvl 2.2s ${E} infinite}@keyframes lvl{0%{transform:translateY(0) scale(1)}12%{transform:translateY(4px) scale(1.07,.9)}30%{transform:translateY(-24px) scale(.95,1.06)}45%{transform:translateY(-28px) scale(1)}62%{transform:translateY(0) scale(1.06,.93)}72%{transform:translateY(-4px) scale(.99,1.01)}82%,100%{transform:translateY(0) scale(1)}}.wing-l{animation:lvlWL 2.2s ${E} infinite}@keyframes lvlWL{0%,12%{transform:rotate(0)}22%{transform:rotate(-28deg)}34%{transform:rotate(12deg)}46%{transform:rotate(-22deg)}60%,100%{transform:rotate(0)}}.wing-r{animation:lvlWR 2.2s ${E} infinite}@keyframes lvlWR{0%,12%{transform:rotate(0)}25%{transform:rotate(-34deg)}36%{transform:rotate(-10deg)}46%{transform:rotate(-28deg)}62%,100%{transform:rotate(0)}}.prop-books{transform-origin:108px 220px;animation:lvlB 2.2s ${E} infinite}@keyframes lvlB{0%,8%,58%{transform:scaleY(1)}12%,64%{transform:scaleY(.9)}20%,72%,100%{transform:scaleY(1)}}.prop-arrow{animation:lvlA 2.2s ${E} infinite}@keyframes lvlA{0%,18%{transform:translateY(22px);opacity:0}32%{opacity:1}52%{transform:translateY(-14px);opacity:1}70%,100%{transform:translateY(-26px);opacity:0}}.prop-sparkles path{animation:lvlS 2.2s ${E} infinite}.prop-sparkles .s2{animation-delay:.1s}.prop-sparkles .s3{animation-delay:.2s}.prop-sparkles .s4{animation-delay:.3s}@keyframes lvlS{0%,30%{transform:scale(0) rotate(0);opacity:0}44%{transform:scale(1.25) rotate(45deg);opacity:1}58%{transform:scale(.9) rotate(70deg);opacity:1}76%,100%{transform:scale(0) rotate(90deg);opacity:0}}` + blinkCss(2.2).replace(/blink/g, 'lvlBl') + earsCss('lu', 2.2, s => `0%,12%{transform:rotate(0)}30%{transform:rotate(${-16 * s}deg)}45%{transform:rotate(${-10 * s}deg)}62%{transform:rotate(${8 * s}deg)}74%,100%{transform:rotate(0)}`)],
  loading: [STATES.loading, `.d1,.d2,.d3{animation:dot 1.2s ${E} infinite}.d2{animation-delay:.2s}.d3{animation-delay:.4s}@keyframes dot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-6px)}}.head{animation:bob 1.2s ${E} infinite}@keyframes bob{0%,100%{transform:rotate(0)}50%{transform:rotate(4deg)}}` + earsCss('ld', 1.2, s => `0%,100%{transform:rotate(0)}${s > 0 ? 25 : 75}%{transform:rotate(${-10 * s}deg)}`)],
  surprised: [{ ...STATES.surprised, bang: true }, `.owl{animation:jolt 2.4s ${E} infinite}@keyframes jolt{0%,55%,100%{transform:translateY(0) scale(1)}6%{transform:translateY(2px) scale(1.07,.91)}14%{transform:translateY(-16px) scale(.94,1.08)}24%{transform:translateY(0) scale(1.05,.95)}32%{transform:translateY(-3px) scale(1)}40%{transform:translateY(0)}}.eyes{animation:widen 2.4s ${E} infinite}@keyframes widen{0%,8%,62%,100%{transform:scale(1)}14%,46%{transform:scale(1.2)}}.pupils{animation:jit 2.4s linear infinite}@keyframes jit{0%,14%,46%,100%{transform:translate(0,0)}18%{transform:translate(1.5px,-1px)}22%{transform:translate(-1.5px,-1px)}26%{transform:translate(1px,0)}30%{transform:translate(-1px,0)}}.wing-l{animation:flingL 2.4s ${E} infinite}@keyframes flingL{0%,8%,52%,100%{transform:rotate(0)}16%{transform:rotate(42deg)}24%{transform:rotate(24deg)}32%{transform:rotate(36deg)}}.wing-r{animation:flingR 2.4s ${E} infinite}@keyframes flingR{0%,8%,52%,100%{transform:rotate(0)}16%{transform:rotate(-42deg)}24%{transform:rotate(-24deg)}32%{transform:rotate(-36deg)}}.prop-bang{animation:bang 2.4s ${E} infinite}@keyframes bang{0%,8%{transform:scale(0) rotate(-20deg);opacity:0}16%{transform:scale(1.35) rotate(10deg);opacity:1}24%{transform:scale(.92) rotate(-6deg)}30%,54%{transform:scale(1) rotate(0);opacity:1}64%,100%{transform:scale(0);opacity:0}}` + earsCss('sp', 2.4, s => `0%,8%,60%,100%{transform:rotate(0)}14%{transform:rotate(${18 * s}deg)}22%{transform:rotate(${6 * s}deg)}30%,46%{transform:rotate(${12 * s}deg)}`)],
  raisehand: [STATES.raisehand, `.wing-r{animation:raise 1.2s ${E} infinite alternate}@keyframes raise{from{transform:rotate(-8deg)}to{transform:rotate(10deg)}}.owl{animation:stretch 1.2s ${E} infinite alternate}@keyframes stretch{to{transform:translateY(-3px)}}` + earsCss('rh', 1.2, s => `0%,100%{transform:rotate(0)}50%{transform:rotate(${10 * s}deg)}`)],
  celebrate: [STATES.celebrate, `.owl{animation:jump .8s ${E} infinite}@keyframes jump{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}.wing-l{animation:flapL .4s ${E} infinite alternate}.wing-r{animation:flapR .4s ${E} infinite alternate}@keyframes flapL{to{transform:rotate(-16deg)}}@keyframes flapR{to{transform:rotate(16deg)}}.prop-confetti rect{animation:fall 1.6s linear infinite}.c2{animation-delay:-.4s!important}.c3{animation-delay:-.8s!important}.c4{animation-delay:-1.2s!important}@keyframes fall{0%{transform:translateY(-14px);opacity:0}20%{opacity:1}100%{transform:translateY(40px);opacity:0}}` + earsCss('cb', .8, s => `0%,100%{transform:rotate(0)}50%{transform:rotate(${-12 * s}deg)}`)],
  sad: [STATES.sad, `.prop-tear{animation:tear 2.4s ease-in infinite}@keyframes tear{0%,20%{transform:translateY(0);opacity:0}30%{opacity:1}100%{transform:translateY(26px);opacity:0}}.head{animation:sigh 2.4s ${E} infinite}@keyframes sigh{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}` + earsCss('sd', 2.4, s => `0%,100%{transform:rotate(0)}50%{transform:rotate(${-8 * s}deg)}`)],
  heart: [STATES.heart, `.prop-heart{animation:beat 1s ${E} infinite}@keyframes beat{0%,100%{transform:scale(1) translateY(0)}20%{transform:scale(1.25) translateY(-2px)}40%{transform:scale(.95)}60%{transform:scale(1.12) translateY(-4px)}}.owl{animation:sway 2s ${E} infinite}@keyframes sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}` + earsCss('ht', 1, s => `0%,100%{transform:rotate(0)}30%{transform:rotate(${-8 * s}deg)}`)],
  typing: [STATES.laptop, `.hand-l{animation:typeL .3s ${E} infinite alternate}.hand-r{animation:typeR .3s ${E} .15s infinite alternate}@keyframes typeL{to{transform:translateY(-3px) rotate(-6deg)}}@keyframes typeR{to{transform:translateY(-3px) rotate(6deg)}}.head{animation:focus 2.4s ${E} infinite}@keyframes focus{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}` + blinkCss(3) + earsCss('ty', .6, s => `0%,100%{transform:rotate(0)}50%{transform:rotate(${-5 * s}deg)}`)],
  read: [STATES.read, `.pupils{animation:rd 4s ${E} infinite}@keyframes rd{0%,4%{transform:translate(-4px,-1px)}20%{transform:translate(4px,-1px)}24%{transform:translate(-4px,2px)}40%{transform:translate(4px,2px)}44%{transform:translate(-4px,4px)}58%{transform:translate(4px,4px)}66%{transform:translate(3px,1px)}82%{transform:translate(-4px,0)}100%{transform:translate(-4px,-1px)}}.head{animation:rdH 4s ${E} infinite}@keyframes rdH{0%,4%{transform:rotate(-2deg)}20%{transform:rotate(2deg)}24%{transform:rotate(-2deg)}40%{transform:rotate(2deg)}44%{transform:rotate(-2deg)}58%{transform:rotate(2deg)}82%,100%{transform:rotate(-2deg)}}.prop-page{animation:flip 4s ${E} infinite}@keyframes flip{0%,64%{transform:scaleX(1)}82%,100%{transform:scaleX(-1)}}.prop-book,.hands{animation:rdB 4s ${E} infinite}@keyframes rdB{0%,60%,100%{transform:translateY(0)}68%{transform:translateY(-3px)}78%{transform:translateY(0)}}` + earsCss('rdE', 4, s => `0%,62%,100%{transform:rotate(0)}70%{transform:rotate(${8 * s}deg)}80%{transform:rotate(${-3 * s}deg)}`)],
  curious: [STATES.curious, `.head{animation:cur 3.2s ${E} infinite}@keyframes cur{0%,12%,100%{transform:rotate(0)}28%,50%{transform:rotate(-18deg)}66%,86%{transform:rotate(5deg)}}.pupils{animation:curP 3.2s ${E} infinite}@keyframes curP{0%,12%,100%{transform:translate(0,0)}28%,50%{transform:translate(-10px,-3px)}66%,86%{transform:translate(-1px,-4px)}}.owl{animation:lean 3.2s ${E} infinite}@keyframes lean{0%,12%,100%{transform:rotate(0)}28%,50%{transform:rotate(-3deg) translateY(-2px)}66%,86%{transform:rotate(1.5deg)}}` + blinkCss(3.2).replace(/blink/g, 'cuBl') + earsCss('cu', 3.2, s => `0%,12%,100%{transform:rotate(0)}30%{transform:rotate(${12 * s}deg)}36%{transform:rotate(${4 * s}deg)}42%,50%{transform:rotate(${12 * s}deg)}66%,86%{transform:rotate(${-6 * s}deg)}`)],
  trophy: [STATES.trophy, `.prop-trophy{transform-origin:108px 196px;animation:hoist 2s ${E} infinite}@keyframes hoist{0%,100%{transform:translateY(0) rotate(0)}35%{transform:translateY(-12px) rotate(0)}45%{transform:translateY(-12px) rotate(-6deg)}55%{transform:translateY(-12px) rotate(6deg)}65%{transform:translateY(-12px) rotate(0)}}.hands,.wing-l,.wing-r{animation:hoistW 2s ${E} infinite}@keyframes hoistW{0%,100%{transform:translateY(0)}35%,65%{transform:translateY(-12px)}}.owl{animation:proud 2s ${E} infinite}@keyframes proud{0%,100%{transform:translateY(0) scale(1)}35%,65%{transform:translateY(-3px) scale(1.01,1)}}.prop-sparkles path{animation:trS 2s ${E} infinite}.prop-sparkles .s2{animation-delay:.25s}.prop-sparkles .s3{animation-delay:.5s}.prop-sparkles .s4{animation-delay:.75s}@keyframes trS{0%,100%{transform:scale(.2) rotate(0);opacity:.2}50%{transform:scale(1.2) rotate(45deg);opacity:1}}` + earsCss('tr', 2, s => `0%,100%{transform:rotate(0)}40%,60%{transform:rotate(${-10 * s}deg)}`)],
  graduate: [{ ...STATES.graduate, spark: 2 }, `.prop-cap{transform-origin:108px 80px;animation:toss 2.8s ${E} infinite}@keyframes toss{0%,10%{transform:translateY(0) rotate(0)}30%{transform:translateY(-28px) rotate(-16deg)}42%{transform:translateY(-34px) rotate(10deg)}58%{transform:translateY(0) rotate(0)}62%{transform:translateY(2px)}66%,100%{transform:translateY(0)}}.owl{animation:hop 2.8s ${E} infinite}@keyframes hop{0%,6%{transform:translateY(0) scale(1)}10%{transform:translateY(1px) scale(1.05,.94)}22%{transform:translateY(-7px) scale(.97,1.03)}34%,58%{transform:translateY(0) scale(1)}62%{transform:scale(1.03,.97)}68%,100%{transform:scale(1)}}.wing-l{animation:grL 2.8s ${E} infinite}@keyframes grL{0%,10%,42%,100%{transform:rotate(0)}20%{transform:rotate(34deg)}30%{transform:rotate(16deg)}}.wing-r{animation:grR 2.8s ${E} infinite}@keyframes grR{0%,10%,42%,100%{transform:rotate(0)}20%{transform:rotate(-34deg)}30%{transform:rotate(-16deg)}}.prop-sparkles path{animation:grS 2.8s ${E} infinite}.prop-sparkles .s2{animation-delay:.1s}.prop-sparkles .s3{animation-delay:.2s}.prop-sparkles .s4{animation-delay:.3s}@keyframes grS{0%,56%{transform:scale(0) rotate(0);opacity:0}66%{transform:scale(1.25) rotate(45deg);opacity:1}80%{transform:scale(.9) rotate(70deg);opacity:1}94%,100%{transform:scale(0) rotate(90deg);opacity:0}}` + earsCss('gr', 2.8, s => `0%,10%,100%{transform:rotate(0)}20%{transform:rotate(${14 * s}deg)}34%{transform:rotate(${-4 * s}deg)}60%{transform:rotate(${-8 * s}deg)}70%{transform:rotate(0)}`)],
  wink: [{ ...STATES.wink, spark: 1 }, `.head{animation:wkH 2.4s ${E} infinite}@keyframes wkH{0%,18%,82%,100%{transform:rotate(0)}32%,68%{transform:rotate(-7deg)}}.owl{animation:wkO 2.4s ${E} infinite}@keyframes wkO{0%,18%,82%,100%{transform:translateY(0)}32%,68%{transform:translateY(-3px)}}.wing-l{animation:wkW .6s ${E} infinite alternate}@keyframes wkW{to{transform:rotate(10deg)}}.prop-sparkles .s1{opacity:0}.prop-sparkles .s2{animation:wkS 2.4s ${E} infinite}@keyframes wkS{0%,28%{transform:scale(0) rotate(0);opacity:0}40%{transform:scale(1.25) rotate(45deg);opacity:1}56%{transform:scale(.9) rotate(70deg);opacity:1}70%,100%{transform:scale(0) rotate(90deg);opacity:0}}` + earsCss('wk', 2.4, s => `0%,18%,82%,100%{transform:rotate(0)}${s > 0 ? '32%,68%{transform:rotate(4deg)}' : '32%{transform:rotate(14deg)}38%{transform:rotate(4deg)}44%,68%{transform:rotate(12deg)}'}`)],
  point: [STATES.point, `.wing-r{animation:jab 1.6s ${E} infinite}@keyframes jab{0%,100%{transform:translateX(0) rotate(0)}25%{transform:translateX(7px) rotate(-5deg)}40%{transform:translateX(2px) rotate(0)}55%{transform:translateX(7px) rotate(-5deg)}75%{transform:translateX(0) rotate(0)}}.pupils{animation:ptP 1.6s ${E} infinite}@keyframes ptP{0%,100%{transform:translateX(0)}25%,60%{transform:translateX(2px)}}.head{animation:ptH 1.6s ${E} infinite}@keyframes ptH{0%,100%{transform:rotate(0)}25%,55%{transform:rotate(4deg)}40%{transform:rotate(2deg)}}.owl{animation:ptO 1.6s ${E} infinite}@keyframes ptO{0%,100%{transform:rotate(0)}25%,60%{transform:rotate(2deg)}}` + earsCss('pt', 1.6, s => `0%,100%{transform:rotate(0)}25%,55%{transform:rotate(${-8 * s}deg)}`)],
};

// CSS auf eine SVG-ID begrenzen, damit mehrere Animationen auf einer Seite sich nicht beeinflussen
function scopeCss(css, id) {
  const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]);
  for (const n of names) css = css.replace(new RegExp('(@keyframes\\s+|[\\s:,])' + n + '(?=[\\s{;,]|$)', 'g'), (m, p) => p + id + '-' + n);
  let out = '', i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i); if (open < 0) break;
    const sel = css.slice(i, open).trim();
    let depth = 1, j = open + 1; while (depth && j < css.length) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const body = css.slice(open, j);
    out += sel.startsWith('@') ? sel + body : sel.split(',').map(s => '#' + id + ' ' + s.trim()).join(',') + body;
    i = j;
  }
  return out;
}
function animSvg(key, opt = {}) {
  const [st, css] = ANIMS[key], id = 'owl-' + key + (opt.body ? '-dark' : '');
  const c = scopeCss(css, id);
  return st === null ? sleep({ ...opt, css: c, id }) : owl({ ...st, ...opt, css: c, id });
}

const OwlGen = { owl, sleep, icon, animSvg, STATES, ANIMS, DARK: { body: SLATE6 } };
export default OwlGen;
