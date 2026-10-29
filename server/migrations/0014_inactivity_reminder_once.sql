-- Migration 0014: Erinnerungs-Mail vor der Inaktivitäts-Löschung nur einmal je Inaktivitätsphase (K8)
--
-- inactivity_reminded_at: Zeitpunkt der letzten Erinnerung. Eine neue Erinnerung geht nur raus,
-- wenn sich die Lehrkraft seitdem angemeldet hat (last_login_at > inactivity_reminded_at) oder noch
-- nie erinnert wurde. Keine IP-Spalten (K10).

ALTER TABLE users ADD COLUMN inactivity_reminded_at INTEGER;
