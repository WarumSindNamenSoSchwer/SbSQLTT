// Abnahmelauf gegen den Probe-Stack (echtes API-Image hinter Caddy mit Go-live-Block), Klassen-Login.
// Läuft auf dem Server; spricht nur über Caddy (BASE, Standard http://127.0.0.1:18080).
// Nutzt dieselbe Kryptografie wie der Browser: /crypto.mjs (gebündelt mit tools/bundle-crypto.mjs).
import * as C from '/crypto.mjs'

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
const T_PW = 'geheimnis123'
const T_MAIL = `lk${rnd}@example.org`

// K2 Lehrkraft: Schlüsselpaar entsteht im "Browser"
const recovery = C.generateRecoveryCode()
const keys = await C.createTeacherKeys(T_PW, recovery)
let r = await T.req('POST', '/api/register', { display_name: 'Frau Probe', name: 'Paula Probe', email: T_MAIL, password: T_PW, terms_accepted: true, keys: keys.bundle })
ok('K2 Lehrkraft registriert (201)', r.status === 201, JSON.stringify(r.json))
ok('K6 Cookie tabula_session HttpOnly, SameSite=Lax, Path=/, Max-Age 30 Tage', /tabula_session=/.test(T.setCookie) && /HttpOnly/i.test(T.setCookie) && /SameSite=Lax/i.test(T.setCookie) && /Max-Age=2592000/.test(T.setCookie), T.setCookie)
r = await G.req('POST', '/api/register', { display_name: 'X', name: 'X', email: `x${rnd}@example.org`, password: T_PW, terms_accepted: true })
ok('K2 Registrierung ohne Schlüsselpaar abgelehnt (400)', r.status === 400)

// CSRF durch Caddy
const evil = await fetch(B + '/api/login', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ login: T_MAIL, password: T_PW }) })
ok('CSRF: fremder Origin abgelehnt (403)', evil.status === 403)

// Klasse, Klassen-Login der Schüler
r = await T.req('POST', '/api/teacher/classes', { name: '10p' })
const cls = r.json?.class
ok('Klasse angelegt, Wort-Code', r.status === 201 && /^[a-z]+-[a-z]+-[a-z]+-\d{2}$/.test(cls?.join_code || ''), JSON.stringify(cls))
const info = (await G.req('GET', `/api/class-login/lookup?code=${encodeURIComponent(cls.join_code.toUpperCase())}`)).json
ok('Klasse nachschlagen: Name, Lehrkraft, Salz, öffentlicher Schlüssel', info?.class_name === '10p' && info?.teacher_name === 'Frau Probe' && info?.public_key === keys.bundle.public_key, JSON.stringify(info).slice(0, 120))
const pub = await C.importPublicKey(info.public_key)
async function join(b, name, pw) {
  const key = await C.deriveStudentKey(info.class_salt, name, pw)
  const res = await b.req('POST', '/api/class-login/join', { code: cls.join_code, key, enc_name: await C.sealForTeacher(pub, name) })
  return { res, key }
}
const a = await join(S1, 'Ali Akbulut', 'aliPasswort1')
ok('Schüler 1 tritt bei (201)', a.res.status === 201)
const b = await join(S2, 'Bea Brandt', 'beaPasswort2')
ok('Schüler 2 tritt bei (201)', b.res.status === 201)
ok('Gleicher Name und gleiches Passwort abgelehnt (409)', (await join(browser(), 'ali akbulut', 'aliPasswort1')).res.status === 409)
r = await S1.req('GET', '/api/me')
ok('/api/me des Schülers ohne Namen', r.json?.user?.role === 'student' && !JSON.stringify(r.json).includes('Ali'), JSON.stringify(r.json).slice(0, 160))

await T.req('PUT', `/api/teacher/classes/${cls.id}/lessons`, { lessons: [{ lesson_id: 'where-filters', unlocked: true, sort_order: 0, is_focus: true }] })
r = await S1.req('GET', '/api/classes/mine')
ok('Schüler sieht Fokus-Lektion', r.json?.classes?.[0]?.lessons?.some((l) => l.is_focus && l.lesson_id === 'where-filters'), JSON.stringify(r.json))
ok('Schüler kommt nicht ins Lehrer-Dashboard (403)', (await S1.req('GET', `/api/teacher/classes/${cls.id}/dashboard`)).status === 403)

// Fortschritt, hängt fest, letzte Abfrage nur verschlüsselt
const now = Math.floor(Date.now() / 1000)
const sealed = await C.sealForTeacher(pub, JSON.stringify({ q: 'SELECT yeer FROM books', e: 'Spalte yeer fehlt' }))
await S1.req('PUT', '/api/progress', { progress: [{ lesson_id: 'where-filters', step: 2, done: false, attempts: 3, updated_at: now }], last_attempts: [{ lesson_id: 'where-filters', step: 2, sealed, has_error: true }] })
r = await T.req('GET', `/api/teacher/classes/${cls.id}/dashboard`)
const names = await Promise.all((r.json?.students ?? []).map((s) => C.openForTeacher(keys.privateKey, s.enc_name)))
const ali = r.json?.students?.[names.indexOf('Ali Akbulut')]
ok('Dashboard: Lehrkraft entschlüsselt Namen, Ali hängt fest', ali?.status === 'haengt_fest' && names.includes('Bea Brandt'), JSON.stringify(names))
r = await T.req('GET', `/api/teacher/classes/${cls.id}/students/${ali.user_id}/last-attempt`)
const la = r.json?.last_attempts?.[0]
ok('Letzte Abfrage nur verschlüsselt, Lehrkraft liest sie', la && la.query === undefined && JSON.parse(await C.openForTeacher(keys.privateKey, la.sealed)).q === 'SELECT yeer FROM books')

// Anmeldung an einem anderen PC
const S1b = browser()
r = await S1b.req('POST', '/api/class-login/login', { code: cls.join_code, key: await C.deriveStudentKey(info.class_salt, '  ali AKBULUT ', 'aliPasswort1') })
ok('Anderer PC: Anmeldung mit Code, Name, Passwort', r.status === 200)
r = await S1b.req('GET', '/api/progress')
ok('Anderer PC lädt Fortschritt', r.json?.progress?.some((p) => p.lesson_id === 'where-filters' && p.attempts === 3), JSON.stringify(r.json))
ok('Falsches Passwort: 401', (await browser().req('POST', '/api/class-login/login', { code: cls.join_code, key: await C.deriveStudentKey(info.class_salt, 'Ali Akbulut', 'falsch12345') })).status === 401)

// Passwort vergessen: Einmal-Code
r = await T.req('POST', `/api/teacher/classes/${cls.id}/students/${ali.user_id}/reset-code`)
const rc = r.json?.code
ok('Einmal-Code erzeugt', /^[2-9A-HJ-NP-Z]{8}$/.test(rc || ''), JSON.stringify(r.json))
const S1c = browser()
r = await S1c.req('POST', '/api/class-login/reset', { code: cls.join_code, reset_code: rc, key: await C.deriveStudentKey(info.class_salt, 'Ali Akbulut', 'neuesAliPw9'), enc_name: await C.sealForTeacher(pub, 'Ali Akbulut') })
ok('Neues Passwort mit Einmal-Code gesetzt', r.status === 200)

// Fremde Lehrkraft
const T2 = browser()
const k2 = await C.createTeacherKeys(T_PW, C.generateRecoveryCode())
await T2.req('POST', '/api/register', { display_name: 'Herr X', name: 'X', email: `lx${rnd}@example.org`, password: T_PW, terms_accepted: true, keys: k2.bundle })
ok('K4 fremde Lehrkraft: Klasse 404', (await T2.req('GET', `/api/teacher/classes/${cls.id}`)).status === 404)
ok('K4 fremde Lehrkraft: Einmal-Code 404', (await T2.req('POST', `/api/teacher/classes/${cls.id}/students/${ali.user_id}/reset-code`)).status === 404)

// Quiz über WebSocket durch Caddy
ok('Quiz ohne Klasse abgelehnt (400)', (await T.req('POST', '/api/teacher/quiz-sessions', { bank_lesson_id: 'where-filters' })).status === 400)
r = await T.req('POST', '/api/teacher/quiz-sessions', { bank_lesson_id: 'where-filters', class_id: cls.id })
const room = r.json
ok('Quiz aus Fragenbank gestartet', r.status === 201 && /^[A-Z2-9]{6}$/.test(room?.pin || ''), JSON.stringify(r.json))
const WS = B.replace('http', 'ws') + '/api/quiz/ws'
function wsClient(cookie) {
  const ws = new WebSocket(WS, { headers: { origin: ORIGIN, cookie } })
  const q = []; const waiters = []; const all = []
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); all.push(m); const i = waiters.findIndex((w) => w.t === m.type); if (i >= 0) waiters.splice(i, 1)[0].res(m); else q.push(m) })
  const wait = (t, ms = 8000) => new Promise((res, rej) => { const i = q.findIndex((m) => m.type === t); if (i >= 0) return res(q.splice(i, 1)[0]); waiters.push({ t, res }); setTimeout(() => rej(new Error('timeout ' + t)), ms) })
  const open = new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  return { ws, wait, open, all, send: (m) => ws.send(JSON.stringify(m)) }
}
const tw = wsClient(T.cookie); await tw.open; tw.send({ type: 'teacher_join', room_id: room.id })
const tj = await tw.wait('joined')
ok('WS durch Caddy: Lehrkraft verbunden (Cookie-Auth), bekommt PIN für den Beamer', tj.role === 'teacher' && tj.pin === room.pin, JSON.stringify(tj))
const s1w = wsClient(S1c.cookie); await s1w.open; s1w.send({ type: 'student_join', pin: room.pin })
const j1 = await s1w.wait('joined')
ok('WS: Schüler aus Klassen-Login tritt bei, ohne Namen', j1.role === 'student' && !('display_name' in j1), JSON.stringify(j1))
const s2w = wsClient(S2.cookie); await s2w.open; s2w.send({ type: 'student_join', pin: room.pin }); await s2w.wait('joined')
const gw = wsClient(''); await gw.open; gw.send({ type: 'student_join', pin: room.pin })
ok('WS: Gast ohne Anmeldung abgelehnt', (await gw.wait('error')).code === 'login_required')
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
ok('WS: Auflösung mit Zählung', typeof rev.correct_idx === 'number' && rev.answer_counts?.reduce((x, y) => x + y, 0) === 2, JSON.stringify(rev))
ok('WS: Punkte nur bei richtiger Antwort', ack.correct === (rev.correct_idx === 0) && (ack.correct ? ack.points > 0 : ack.points === 0), JSON.stringify(ack))
const lb = await tw.wait('leaderboard')
const lbNames = await Promise.all(lb.rankings.map((x) => C.openForTeacher(keys.privateKey, x.enc_name)))
ok('WS: Lehrkraft entschlüsselt Rangliste', lbNames.sort().join(',') === 'Ali Akbulut,Bea Brandt', JSON.stringify(lbNames))
const mr = await s1w.wait('my_rank')
ok('WS: Schüler sieht nur eigenen Platz', mr.of === 2 && [1, 2].includes(mr.rank))
ok('WS: Schüler bekamen nie verschlüsselte Namen', ![...s1w.all, ...s2w.all].some((m) => JSON.stringify(m).includes('enc_name')))
tw.send({ type: 'end_quiz' }); await s1w.wait('quiz_ended')
r = await T.req('GET', `/api/teacher/quiz-sessions/${room.id}/result`)
ok('Auswertung: 2 Schüler, Frage-Statistik vorhanden', r.json?.participants?.length === 2 && r.json?.question_stats?.length === 1 && r.json.question_stats[0].answer_count === 2, JSON.stringify(r.json).slice(0, 200))
for (const c of [tw, s1w, s2w, gw]) try { c.ws.close() } catch {}

// Wiederherstellungscode prüfen über /api/me/keys. Außerhalb von "Passwort vergessen" braucht das
// das aktuelle Passwort (Härtung P9): ohne 403, mit Passwort ok.
const me = (await T.req('GET', '/api/me')).json.user
const pk = await C.unwrapWithSecret(C.normalizeRecoveryCode(recovery), me.keys.wrapped_by_recovery)
const rekeys = { public_key: me.keys.public_key, wrapped_by_password: await C.wrapWithSecret(T_PW, pk), wrapped_by_recovery: me.keys.wrapped_by_recovery }
ok('Schlüssel ändern ohne Passwort abgelehnt (403)', (await T.req('POST', '/api/me/keys', { keys: rekeys })).status === 403)
r = await T.req('POST', '/api/me/keys', { keys: rekeys, current_password: T_PW })
ok('Wiederherstellungscode öffnet den Schlüssel, gleiches Paar', r.json?.new_pair === false)

// K8 Austreten und Löschen
ok('K8 Schüler tritt aus (200)', (await S2.req('POST', '/api/student/leave')).status === 200)
ok('K8 danach Anmeldung unmöglich (401)', (await browser().req('POST', '/api/class-login/login', { code: cls.join_code, key: b.key })).status === 401)
ok('K8 Konto löschen ohne Passwort abgelehnt (400)', (await T2.req('DELETE', '/api/me')).status === 400)
ok('K8 Lehrkraft 2 löscht Konto (200)', (await T2.req('DELETE', '/api/me', { password: T_PW })).status === 200)
ok('Abmelden löscht Cookie', (await T.req('POST', '/api/logout')).status === 200 && T.cookie === '')

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail ? 1 : 0)
