/**
 * Playwright E2E-Tests für P3: Kontaktformular
 *
 * Voraussetzungen:
 *   - contact/ Dev-Dienst läuft auf http://127.0.0.1:3001 (JSON-Transport)
 *     cd contact && ALLOWED_ORIGIN=http://localhost:5194 node --import tsx/esm src/dev-index.ts &
 *   - Vite läuft auf http://localhost:5194
 *     npm run dev &
 *
 * Starten (aus Repo-Root):
 *   PWCACHE=$JCODE_SCRATCH_DIR/pw npx playwright test e2e/kontakt.spec.ts \
 *     --browser=chromium \
 *     --screenshot on \
 *     --reporter line
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const BASE = 'http://localhost:5194';
const SCREENSHOTS_DIR = '/Users/muri/.jcode/scratch/pw/screenshots';

// Sicherstellen, dass Screenshot-Verzeichnis existiert
try { fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true }); } catch {}

async function gotoKontakt(page: Page) {
  await page.goto(`${BASE}/kontakt`);
  await page.waitForLoadState('networkidle');
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, `${name}.png`),
    fullPage: true,
  });
}

// ===========================================================================
// Tests
// ===========================================================================

test.describe('/kontakt Formular', () => {
  test('zeigt Kontaktformular-Seite', async ({ page }) => {
    await gotoKontakt(page);
    await expect(page.getByRole('heading', { name: /kontakt/i })).toBeVisible();
    await expect(page.getByPlaceholder('Dein Name')).toBeVisible();
    await expect(page.getByPlaceholder('deine@email.de')).toBeVisible();
    await expect(page.getByPlaceholder(/nachricht/i)).toBeVisible();
    await screenshot(page, '01-formular-leer');
  });

  test('Desktop-Screenshot 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoKontakt(page);
    await screenshot(page, '02-desktop-1440x900');
  });

  test('Mobile-Screenshot 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoKontakt(page);
    await screenshot(page, '03-mobile-390x844');
  });

  test('Link zum Datenschutz vorhanden', async ({ page }) => {
    await gotoKontakt(page);
    await expect(page.getByRole('link', { name: /datenschutz/i })).toBeVisible();
  });

  test('Formular erfolgreich absenden (alle Felder)', async ({ page }) => {
    await gotoKontakt(page);

    // Formular ausfüllen
    await page.getByPlaceholder('Dein Name').fill('Max Mustermann');
    await page.getByPlaceholder('deine@email.de').fill('max@example.com');
    await page.getByPlaceholder(/muster.gymnasium/i).fill('Testschule Berlin');
    await page.getByPlaceholder(/nachricht/i).fill(
      'Das ist eine Test-Nachricht mit mehr als zehn Zeichen.'
    );

    // Zeitfalle: elapsed muss >= 3000ms sein. loadedAt wird in onMount gesetzt.
    // Warte 3.5s sicherheitshalber, falls der Test sehr schnell lief.
    await page.waitForTimeout(3500);

    await screenshot(page, '04-formular-ausgefuellt');

    await page.getByRole('button', { name: 'Nachricht senden' }).click();

    // Erfolgsmeldung abwarten
    await expect(
      page.getByRole('heading', { name: 'Nachricht gesendet!' })
    ).toBeVisible({ timeout: 8000 });

    await screenshot(page, '05-erfolg');
  });

  test('Validierungsfehler bei leerem Formular', async ({ page }) => {
    await gotoKontakt(page);
    await page.getByRole('button', { name: 'Nachricht senden' }).click();

    // Svelte zeigt alle drei Fehlermeldungen nach touched=true
    await expect(
      page.getByText('Bitte gib deinen Namen ein.')
    ).toBeVisible({ timeout: 3000 });

    await screenshot(page, '06-validierungsfehler');
  });

  test('Honeypot-Feld ist unsichtbar', async ({ page }) => {
    await gotoKontakt(page);

    // Das website-Feld darf nicht sichtbar sein
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveCount(1);

    // Soll via CSS off-screen sein (position:absolute, left:-9999px)
    // isVisible() gibt true zurück, wenn DOM-Element existiert und kein display:none
    // Playwright prüft ob Element im Viewport sichtbar ist mit toBeHidden + display/opacity
    // Wir prüfen stattdessen, dass es außerhalb des Sichtbereichs positioniert ist
    const box = await honeypot.boundingBox();
    // Off-screen: x-Position weit negativ oder Element hat keine Box
    const isOffscreen = box === null || box.x < -1000;
    expect(isOffscreen).toBe(true);
  });

  test('Impressum enthält Kontaktformular-Link und Kontakt-Abschnitt', async ({ page }) => {
    // Impressum hat den Kontaktformular-Link sowohl im Body als auch über Footer.svelte
    // (Footer wird in der nicht-bare Layout-Sektion gerendert)
    await page.goto(`${BASE}/impressum`);
    await page.waitForLoadState('networkidle');
    // Kontakt-Überschrift vorhanden
    await expect(page.getByText(/kontakt/i).first()).toBeVisible();
    // Direkter Link im Body
    const kontaktLink = page.getByRole('link', { name: 'Kontaktformular' });
    await expect(kontaktLink).toBeVisible();
    await expect(kontaktLink).toHaveAttribute('href', '/kontakt');
  });
});
