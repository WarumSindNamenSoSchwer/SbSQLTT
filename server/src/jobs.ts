/**
 * Hintergrund-Jobs (K8, K5):
 * - Inaktive Konten nach 12 Monaten loeschen (mit E-Mail-Erinnerung 30 Tage vorher)
 * - Abgelaufene Sitzungen loeschen
 * - Abgelaufene Passwort-Reset-Token loeschen
 * - Quiz-Antworten 24h nach Quiz-Ende loeschen (K5)
 */
import type { Db } from './db.js'
import type { MailSender } from './mail.js'
import { buildSystemMail } from './mail-templates.js'
import { deleteExpiredSessions } from './session.js'

/** 12 Monate in Sekunden */
const INACTIVITY_LIMIT_S = 365 * 24 * 60 * 60
/** 30 Tage Vorwarnung in Sekunden */
const REMINDER_WINDOW_S = 30 * 24 * 60 * 60
/** 24 Stunden in Sekunden */
const QUIZ_ANSWER_TTL_S = 24 * 60 * 60

export interface JobContext {
  db: Db
  mail: MailSender
  siteUrl: string
}

/**
 * Loescht abgelaufene Sitzungen und Passwort-Reset-Token.
 * Sollte regelmaessig (z.B. sttundlich) aufgerufen werden.
 */
export function runCleanupJob(db: Db, now?: number): { sessions: number; resets: number } {
  const nowTs = Math.floor((now ?? Date.now()) / 1000)
  const sessions = deleteExpiredSessions(db, now)
  const resets = (db.prepare('DELETE FROM password_resets WHERE expires_at <= ?').run(nowTs)).changes
  db.prepare('DELETE FROM email_verifications WHERE expires_at <= ?').run(nowTs)
  db.prepare('DELETE FROM student_reset_codes WHERE expires_at <= ?').run(nowTs)
  return { sessions, resets }
}

/**
 * Versendet Erinnerungs-E-Mails an Konten, die in 30 Tagen inaktiv werden.
 * Gibt die Anzahl der versendeten E-Mails zurueck.
 */
export async function runInactivityReminderJob(ctx: JobContext, now?: number): Promise<number> {
  const nowTs = Math.floor((now ?? Date.now()) / 1000)

  // Konten, deren last_login_at vor (12 Monate - 30 Tage) liegt (= in 30 Tagen inaktiv)
  // UND die noch eine E-Mail haben
  const reminderThreshold = nowTs - (INACTIVITY_LIMIT_S - REMINDER_WINDOW_S)
  const deleteThreshold = nowTs - INACTIVITY_LIMIT_S

  // Inaktive Schüler und Lehrkräfte erinnern: nur Lehrkräfte haben eine E-Mail-Adresse
  const candidates = ctx.db.prepare(`
    SELECT id, display_name, email, last_login_at
    FROM users
    WHERE role = 'teacher'
      AND email IS NOT NULL
      AND last_login_at IS NOT NULL
      AND last_login_at <= ?
      AND last_login_at > ?
      AND (inactivity_reminded_at IS NULL OR inactivity_reminded_at < last_login_at)
  `).all(reminderThreshold, deleteThreshold) as {
    id: number
    display_name: string
    email: string
    last_login_at: number
  }[]

  let sent = 0
  for (const user of candidates) {
    const deletionDate = new Date((user.last_login_at + INACTIVITY_LIMIT_S) * 1000)
      .toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

    try {
      await ctx.mail.send(buildSystemMail({
        to: user.email,
        subject: 'Ihr Tabula-Konto wird bald gelöscht',
        preheader: `Melden Sie sich bis zum ${deletionDate} an, dann bleibt alles erhalten.`,
        pose: 'sad',
        greeting: `Hallo ${user.display_name},`,
        intro: [
          'Ihr Lehrkraft-Konto bei Tabula wurde seit mehr als 11 Monaten nicht genutzt. Edgar vermisst Sie schon ein bisschen.',
          `Wenn Sie sich nicht wieder anmelden, wird es am ${deletionDate} automatisch gelöscht, zusammen mit Ihren Klassen und den Daten Ihrer Schüler.`,
        ],
        button: { label: 'Jetzt anmelden', url: `${ctx.siteUrl}/login?rolle=lehrkraft` },
        notes: [
          'Einmal anmelden genügt, dann bleibt alles erhalten. Wenn Sie Tabula nicht mehr brauchen, müssen Sie nichts tun.',
        ],
        siteUrl: ctx.siteUrl,
      }))
      // Erinnerung merken: bis zur nächsten Anmeldung keine weitere Mail (sonst täglich bis zur Löschung)
      ctx.db.prepare('UPDATE users SET inactivity_reminded_at = ? WHERE id = ?').run(nowTs, user.id)
      sent++
    } catch {
      // E-Mail-Fehler nicht weiterwerfen, Job laeuft weiter
    }
  }

  return sent
}

/**
 * Loescht Konten, die seit 12 Monaten inaktiv sind (K8).
 * Gibt die Anzahl der geloeschten Konten zurueck.
 */
export function runInactivityDeletionJob(db: Db, now?: number): number {
  const nowTs = Math.floor((now ?? Date.now()) / 1000)
  const threshold = nowTs - INACTIVITY_LIMIT_S

  const result = db.transaction(() => {
    // Schüler aus Klassen inaktiver Lehrkräfte zuerst (sonst blieben sie ohne Klasse zurück)
    db.prepare(`
      DELETE FROM users WHERE role = 'student' AND id IN (
        SELECT m.user_id FROM memberships m JOIN classes c ON c.id = m.class_id
        JOIN users t ON t.id = c.teacher_id
        WHERE t.last_login_at IS NOT NULL AND t.last_login_at <= ?)
    `).run(threshold)
    return db.prepare(`
      DELETE FROM users
      WHERE last_login_at IS NOT NULL AND last_login_at <= ?
    `).run(threshold)
  })()

  return result.changes
}

/**
 * Loescht Quiz-Antworten 24 Stunden nach Quiz-Ende (K5).
 * Aggregiert vorher in quiz_question_stats und loescht dann quiz_answers + quiz_participants.
 */
export function runQuizCleanupJob(db: Db, now?: number): number {
  const nowTs = Math.floor((now ?? Date.now()) / 1000)
  const threshold = nowTs - QUIZ_ANSWER_TTL_S

  // Raeume die aelter als 24h sind und noch nicht bereinigt wurden
  // (quiz_participants noch vorhanden = noch nicht aggregiert)
  const roomRows = db.prepare(`
    SELECT id FROM quiz_rooms
    WHERE ended_at IS NOT NULL AND ended_at <= ?
      AND EXISTS (SELECT 1 FROM quiz_participants WHERE room_id = quiz_rooms.id)
  `).all(threshold) as { id: number }[]

  let cleaned = 0
  for (const roomRow of roomRows) {
    aggregateAndCleanRoom(db, roomRow.id)
    cleaned++
  }

  return cleaned
}

/**
 * Aggregiert Antworten einer beendeten Quiz-Sitzung in quiz_question_stats
 * und loescht dann quiz_answers und quiz_participants (K5).
 * Kann auch direkt aus quiz-ws.ts aufgerufen werden.
 */
export function aggregateAndCleanRoom(db: Db, roomId: number): void {
  const questions = db.prepare(`
    SELECT qq.id, qq.correct_idx, qq.options
    FROM quiz_questions qq
    JOIN quiz_rooms qr ON qr.set_id = qq.set_id
    WHERE qr.id = ?
  `).all(roomId) as { id: number; correct_idx: number; options: string }[]

  db.transaction(() => {
    for (const q of questions) {
      const options = JSON.parse(q.options) as string[]
      const answers = db.prepare(
        'SELECT chosen_idx, answer_ms FROM quiz_answers WHERE room_id = ? AND question_id = ? AND chosen_idx IS NOT NULL'
      ).all(roomId, q.id) as { chosen_idx: number; answer_ms: number | null }[]

      const counts = new Array<number>(options.length).fill(0)
      let correct = 0
      let totalMs = 0
      let msCount = 0

      for (const a of answers) {
        if (a.chosen_idx >= 0 && a.chosen_idx < counts.length) {
          counts[a.chosen_idx]++
          if (a.chosen_idx === q.correct_idx) correct++
        }
        if (a.answer_ms != null) {
          totalMs += a.answer_ms
          msCount++
        }
      }

      const total = answers.length
      const ratio = total > 0 ? correct / total : 0
      const avgMs = msCount > 0 ? Math.round(totalMs / msCount) : null

      db.prepare(`
        INSERT INTO quiz_question_stats (room_id, question_id, answer_counts, correct_ratio, answer_count, avg_ms)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(room_id, question_id) DO UPDATE SET
          answer_counts = excluded.answer_counts,
          correct_ratio = excluded.correct_ratio,
          answer_count = excluded.answer_count,
          avg_ms = excluded.avg_ms,
          aggregated_at = unixepoch()
      `).run(roomId, q.id, JSON.stringify(counts), ratio, total, avgMs)
    }

    // K5: Einzelantworten und Teilnehmerdaten loeschen
    db.prepare('DELETE FROM quiz_answers WHERE room_id = ?').run(roomId)
    db.prepare('DELETE FROM quiz_participants WHERE room_id = ?').run(roomId)
  })()
}

/**
 * Startet alle Jobs in einem Interval-Timer.
 * Gibt eine cleanup-Funktion zurueck, die die Intervalle stoppt.
 */
export function startJobs(ctx: JobContext, onError: (job: string, err: unknown) => void = () => {}): () => void {
  // Ein Fehler in einem Job (z. B. Datenbank kurz gesperrt) darf den Dienst nicht beenden.
  // Der nächste Lauf versucht es erneut.
  const safe = (job: string, fn: () => unknown) => async () => {
    try { await fn() } catch (err) { onError(job, err) }
  }

  // Stündlich aufräumen
  const cleanupInterval = setInterval(safe('cleanup', () => {
    runCleanupJob(ctx.db)
    runQuizCleanupJob(ctx.db)
  }), 60 * 60 * 1000)

  // Einmal täglich: Inaktivitäts-Erinnerungen und Löschungen
  const dailyInterval = setInterval(safe('daily', async () => {
    await runInactivityReminderJob(ctx)
    runInactivityDeletionJob(ctx.db)
  }), 24 * 60 * 60 * 1000)

  return () => {
    clearInterval(cleanupInterval)
    clearInterval(dailyInterval)
  }
}
