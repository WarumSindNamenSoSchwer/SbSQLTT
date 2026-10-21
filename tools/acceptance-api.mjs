// Abnahmelauf gegen den Probe-Stack (echtes API-Image hinter Caddy mit Go-live-Block).
// Läuft auf dem Server im Netz des Probe-Stacks; spricht nur über Caddy (http://127.0.0.1:18080).
const B = process.env.BASE || 'http://127.0.0.1:18080'
const ORIGIN = B
let pass = 0, fail = 0
const ok = (name, cond, info = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${!cond && info ? '  -> ' + info : ''}`) }

function browser() {
  let cookie = ''
  let setCookieRaw = ''
  const req = async (method, path, body) => {
    const headers = { origin: ORIGIN }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (cookie) headers.cookie = cookie
    const r = await fetch(B + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const sc = r.headers.get('set-cookie')
    if (sc) { setCookieRaw = sc; const v = sc.split(';')[0]; cookie = v.endsWith('=') ? '' : v }
    let json = null; try { json = await r.json() } catch {}
    return { status: r.status, json }
  }
  return { req, get cookie() { return cookie }, get setCookie() { return setCookieRaw } }
}

const rnd = Math.random().toString(36).slice(2, 7)
const T = browser(), S1 = browser(), S2 = browser(), G = browser()

// K1/K2 Registrierung
let r = await T.req('POST', '/api/register', { role: 'teacher', username: 'lk' + rnd, display_name: 'Frau Probe', name: 'Paula Probe', email: `lk${rnd}@example.org`, password: 'geheimnis123', terms_accepted: true })
ok('K2 Lehrkraft registriert (201)', r.status === 201, JSON.stringify(r.json))
ok('K6 Cookie tabula_session HttpOnly, SameSite=Lax, Path=/, Max-Age 30 Tage', /tabula_session=/.test(T.setCookie) && /HttpOnly/i.test(T.setCookie) && /SameSite=Lax/i.test(T.setCookie) && /Max-Age=2592000/.test(T.setCookie), T.setCookie)
r = await S1.req('POST', '/api/register', { role: 'student', username: 'sa' + rnd, display_name: 'Ali', password: 'geheimnis123' })
ok('K1 Schüler registriert ohne E-Mail (201)', r.status === 201)
await S2.req('POST', '/api/register', { role: 'student', username: 'sb' + rnd, display_name: 'Bea', password: 'geheimnis123' })
r = await G.req('POST', '/api/register', { role: 'student', username: 'sc' + rnd, display_name: 'X', password: 'kurz' })
ok('K1 zu kurzes Passwort abgelehnt (400)', r.status === 400)

// CSRF durch Caddy
const evil = await fetch(B + '/api/login', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ login: 'sa' + rnd, password: 'geheimnis123' }) })
ok('CSRF: fremder Origin abgelehnt (403)', evil.status === 403)

// K4 Klasse, Beitritt, Fokus
r = await T.req('POST', '/api/teacher/classes', { name: '10p' })
const cls = r.json?.class
ok('Klasse angelegt', r.status === 201 && /^[A-Z2-9]{6}$/.test(cls?.join_code || ''))
ok('Schüler 1 tritt bei', (await S1.req('POST', '/api/classes/join', { code: cls.join_code })).status === 200)
ok('Schüler 2 tritt bei', (await S2.req('POST', '/api/classes/join', { code: cls.join_code })).status === 200)
await T.req('PUT', `/api/teacher/classes/${cls.id}/lessons`, { lessons: [{ lesson_id: 'where-filters', unlocked: true, sort_order: 0, is_focus: true }] })
r = await S1.req('GET', '/api/classes/mine')
ok('Schüler sieht Fokus-Lektion', r.json?.classes?.[0]?.lessons?.some((l) => l.is_focus && l.lesson_id === 'where-filters'), JSON.stringify(r.json))
r = await S1.req('GET', `/api/teacher/classes/${cls.id}/dashboard`)
ok('Schüler kommt nicht ins Lehrer-Dashboard (403)', r.status === 403)

// Fortschritt + hängt fest + letzte Abfrage
const now = Math.floor(Date.now() / 1000)
await S1.req('PUT', '/api/progress', { progress: [{ lesson_id: 'where-filters', step: 2, done: false, attempts: 3, updated_at: now }], last_attempts: [{ lesson_id: 'where-filters', step: 2, query: 'SELECT yeer FROM books', error_msg: 'Spalte yeer fehlt' }] })
r = await T.req('GET', `/api/teacher/classes/${cls.id}/dashboard`)
const ali = r.json?.students?.find((s) => s.display_name === 'Ali')
ok('Dashboard: Ali hängt fest', ali?.status === 'haengt_fest', JSON.stringify(ali))
r = await T.req('GET', `/api/teacher/classes/${cls.id}/students/${ali.user_id}/last-attempt`)
ok('Letzte Abfrage für Lehrkraft sichtbar', r.json?.last_attempts?.[0]?.query === 'SELECT yeer FROM books')

// Zweites Gerät: Fortschritt kommt an
const S1b = browser()
r = await S1b.req('POST', '/api/login', { login: 'sa' + rnd, password: 'geheimnis123' })
r = await S1b.req('GET', '/api/progress')
ok('Zweites Gerät lädt Fortschritt', r.json?.progress?.some((p) => p.lesson_id === 'where-filters' && p.attempts === 3), JSON.stringify(r.json))

// Fremde Lehrkraft
const T2 = browser()
await T2.req('POST', '/api/register', { role: 'teacher', username: 'lx' + rnd, display_name: 'Herr X', name: 'X', email: `lx${rnd}@example.org`, password: 'geheimnis123', terms_accepted: true })
ok('K4 fremde Lehrkraft: Klasse 404', (await T2.req('GET', `/api/teacher/classes/${cls.id}`)).status === 404)
ok('K4 fremde Lehrkraft: Dashboard 404', (await T2.req('GET', `/api/teacher/classes/${cls.id}/dashboard`)).status === 404)

// Quiz über WebSocket durch Caddy
r = await T.req('POST', '/api/teacher/quiz-sessions', { bank_lesson_id: 'where-filters', class_id: cls.id })
const room = r.json
ok('Quiz aus Fragenbank gestartet', r.status === 201 && /^[A-Z2-9]{6}$/.test(room?.pin || ''), JSON.stringify(r.json))
const WS = B.replace('http', 'ws') + '/api/quiz/ws'
function wsClient(cookie) {
  const ws = new WebSocket(WS, { headers: { origin: ORIGIN, cookie } })
  const q = []; const waiters = []
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); const i = waiters.findIndex((w) => w.t === m.type || (w.t === 'error' && m.type === 'error')); if (i >= 0) waiters.splice(i, 1)[0].res(m); else q.push(m) })
  const wait = (t, ms = 8000) => new Promise((res, rej) => { const i = q.findIndex((m) => m.type === t); if (i >= 0) return res(q.splice(i, 1)[0]); waiters.push({ t, res }); setTimeout(() => rej(new Error('timeout ' + t)), ms) })
  const open = new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  return { ws, wait, open, send: (m) => ws.send(JSON.stringify(m)) }
}
const tw = wsClient(T.cookie); await tw.open; tw.send({ type: 'teacher_join', room_id: room.id })
ok('WS durch Caddy: Lehrkraft verbunden (Cookie-Auth)', (await tw.wait('joined')).role === 'teacher')
const s1w = wsClient(S1.cookie); await s1w.open; s1w.send({ type: 'student_join', pin: room.pin })
const j1 = await s1w.wait('joined')
ok('WS: Schüler tritt mit Konto bei, Name aus Konto', j1.display_name === 'Ali', JSON.stringify(j1))
const s2w = wsClient(S2.cookie); await s2w.open; s2w.send({ type: 'student_join', pin: room.pin }); await s2w.wait('joined')
const gw = wsClient(''); await gw.open; gw.send({ type: 'student_join', pin: room.pin })
ok('WS: Gast ohne Konto abgelehnt', (await gw.wait('error')).code === 'login_required')
tw.send({ type: 'next_question' })
const qs = await s1w.wait('question_start'); await s2w.wait('question_start')
ok('WS: Frage kommt an, ohne Lösung', qs.question && Array.isArray(qs.options) && !('correct_idx' in qs), JSON.stringify(qs).slice(0, 160))
s1w.send({ type: 'answer', question_id: qs.question_id, chosen_idx: 0 })
const ack = await s1w.wait('answer_ack')
s1w.send({ type: 'answer', question_id: qs.question_id, chosen_idx: 1 })
ok('WS: doppelte Antwort verworfen', (await s1w.wait('answer_duplicate')).type === 'answer_duplicate')
s2w.send({ type: 'answer', question_id: qs.question_id, chosen_idx: 1 })
await s2w.wait('answer_ack')
tw.send({ type: 'reveal' })
const rev = await s1w.wait('reveal')
ok('WS: Auflösung mit richtiger Antwort und Zählung', typeof rev.correct_idx === 'number' && rev.answer_counts?.reduce((a, b) => a + b, 0) === 2, JSON.stringify(rev))
ok('WS: Punkte nur bei richtiger Antwort', ack.correct === (rev.correct_idx === 0) && (ack.correct ? ack.points > 0 : ack.points === 0), JSON.stringify(ack))
tw.send({ type: 'end_quiz' }); await s1w.wait('quiz_ended')
r = await T.req('GET', `/api/teacher/quiz-sessions/${room.id}/result`)
ok('Auswertung: 2 Schüler, Frage-Statistik vorhanden', r.json?.participants?.length === 2 && r.json?.question_stats?.length === 1 && r.json.question_stats[0].answer_count === 2, JSON.stringify(r.json).slice(0, 200))
for (const c of [tw, s1w, s2w, gw]) try { c.ws.close() } catch {}

// K8 Konto löschen
ok('K8 Konto löschen (200)', (await S2.req('DELETE', '/api/me')).status === 200)
ok('K8 danach Login unmöglich (401)', (await browser().req('POST', '/api/login', { login: 'sb' + rnd, password: 'geheimnis123' })).status === 401)
ok('Abmelden löscht Cookie', (await T.req('POST', '/api/logout')).status === 200 && T.cookie === '')

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail ? 1 : 0)
