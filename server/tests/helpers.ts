/**
 * Test-Hilfsfunktionen: In-Memory-Datenbank und Klassen-Login mit der echten Browser-Kryptografie.
 */
import { openDb } from '../src/db.js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance } from 'fastify'
import * as C from '../../src/lib/tabula/crypto.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')

// Server-Tests nutzen billigere Argon2-Parameter (k3-password/klassen-login prüfen die echten)
C.__setTestKdfScale(16)

export { C }

/** Öffnet eine frische In-Memory-Datenbank mit allen Migrationen */
export function testDb() {
  return openDb(':memory:', MIGRATIONS_DIR)
}

export function cookieOf(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie']
  const s = (Array.isArray(raw) ? raw[0] : raw) as string
  return s.split(';')[0]
}

export interface TestTeacher {
  cookie: string
  privateKey: CryptoKey
  recoveryCode: string
  password: string
  email: string
}

/** Registriert eine Lehrkraft wie der Browser (Schlüsselpaar wird im "Browser" erzeugt). */
export async function registerTeacher(
  app: FastifyInstance,
  email = 'lehrkraft@schule.de',
  password = 'sicheresPasswort1',
  name = 'Frau Mustermann',
): Promise<TestTeacher> {
  const recoveryCode = C.generateRecoveryCode()
  const { bundle, privateKey } = await C.createTeacherKeys(password, recoveryCode)
  const res = await app.inject({
    method: 'POST', url: '/api/register',
    headers: { 'content-type': 'application/json' },
    payload: { display_name: name, name, email, password, terms_accepted: true, keys: bundle },
  })
  if (res.statusCode !== 201) throw new Error(`register ${res.statusCode} ${res.body}`)
  return { cookie: cookieOf(res), privateKey, recoveryCode, password, email }
}

export async function createClass(app: FastifyInstance, teacherCookie: string, name = 'Testklasse'): Promise<{ id: number; code: string }> {
  const res = await app.inject({
    method: 'POST', url: '/api/teacher/classes',
    headers: { 'content-type': 'application/json', cookie: teacherCookie },
    payload: { name },
  })
  if (res.statusCode !== 201) throw new Error(`createClass ${res.statusCode} ${res.body}`)
  const cls = JSON.parse(res.body).class
  return { id: cls.id, code: cls.join_code }
}

export async function lookup(app: FastifyInstance, code: string) {
  const res = await app.inject({ method: 'GET', url: `/api/class-login/lookup?code=${encodeURIComponent(code)}` })
  if (res.statusCode !== 200) throw new Error(`lookup ${res.statusCode} ${res.body}`)
  return JSON.parse(res.body) as { class_name: string; teacher_name: string; class_salt: string; public_key: string }
}

/** Schüler tritt bei wie der Browser: Schlüssel ableiten, Namen verschlüsseln, nur das schicken. */
export async function joinStudent(app: FastifyInstance, code: string, name: string, password = 'schuelerPw123') {
  const info = await lookup(app, code)
  const key = await C.deriveStudentKey(info.class_salt, name, password)
  const enc_name = await C.sealForTeacher(await C.importPublicKey(info.public_key), C.cleanName(name))
  const res = await app.inject({
    method: 'POST', url: '/api/class-login/join',
    headers: { 'content-type': 'application/json' },
    payload: { code, key, enc_name },
  })
  return { res, cookie: res.statusCode === 201 ? cookieOf(res) : '', key, info }
}

export async function loginStudent(app: FastifyInstance, code: string, name: string, password = 'schuelerPw123') {
  const info = await lookup(app, code)
  const key = await C.deriveStudentKey(info.class_salt, name, password)
  const res = await app.inject({
    method: 'POST', url: '/api/class-login/login',
    headers: { 'content-type': 'application/json' },
    payload: { code, key },
  })
  return { res, cookie: res.statusCode === 200 ? cookieOf(res) : '', key }
}

export async function studentId(db: ReturnType<typeof testDb>, key: string): Promise<number> {
  const { createHash } = await import('node:crypto')
  const row = db.prepare('SELECT id FROM users WHERE login_hash = ?').get(createHash('sha256').update(key).digest('hex')) as { id: number }
  return row.id
}
