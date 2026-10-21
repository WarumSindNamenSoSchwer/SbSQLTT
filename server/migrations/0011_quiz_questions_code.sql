-- Migration 0011: quiz_questions.code - optionaler SQL-Codeblock fuer Fragen (P7b)
--
-- Das Feld 'code' enthaelt optionalen SQL-Code, der zusammen mit der Frage
-- auf dem Beamer und dem Schüler-Handy als hervorgehobener Codeblock dargestellt wird.
-- NULL = keine Code-Anzeige.

ALTER TABLE quiz_questions ADD COLUMN code TEXT;
