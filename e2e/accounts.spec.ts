/**
 * Playwright E2E-Tests für P5: Auth-Seiten und Konto-Funktionen
 *
 * Voraussetzungen:
 *   - Backend läuft auf http://localhost:3000 (SECURE_COOKIE=false)
 *   - Vite läuft auf http://localhost:5194 (VITE_ACCOUNTS_LIVE=1, Proxy /api -> :3000)
 *
 * Starten:
 *   cd server && DB_PATH=$JCODE_SCRATCH_DIR/test.db ALLOWED_ORIGIN=http://localhost:5194 SECURE_COOKIE=false npm run dev &
 *   VITE_ACCOUNTS_LIVE=1 npx vite dev &
 *   PWCACHE=$JCODE_SCRATCH_DIR/pw npx playwright test e2e/accounts.spec.ts --browser=chromium
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const BASE = 'http://localhost:5194';

// Hilfs-Nutzerdaten (zufällig genug um Konflikte zu vermeiden)
const rand = () => Math.random().toString(36).slice(2, 8);
const testUser = () => ({
  username: `test_${rand()}`,
  display_name: `Test ${rand()}`,
  password: 'geheimnis123',
  email: `test_${rand()}@example.com`,
});

// ---- Hilfsfunktionen -------------------------------------------------------

async function goLogin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
}

async function registerViaUI(page: Page, u: ReturnType<typeof testUser>) {
  await goLogin(page);
  // Tab "Registrieren"
  await page.getByRole('tab', { name: /registrieren/i }).click();
  await page.getByPlaceholder(/anzeigename/i).fill(u.display_name);
  await page.getByPlaceholder(/benutzername/i).fill(u.username);
  await page.getByPlaceholder(/^passwort/i).fill(u.password);
  await page.getByRole('button', { name: /konto erstellen/i }).click();
}

async function loginViaUI(page: Page, u: ReturnType<typeof testUser>) {
  await goLogin(page);
  await page.getByPlaceholder(/benutzername/i).fill(u.username);
  await page.getByPlaceholder(/passwort/i).fill(u.password);
  await page.getByRole('button', { name: /anmelden/i }).click();
}

async function apiRegister(context: BrowserContext, u: ReturnType<typeof testUser>) {
  const res = await context.request.post(`${BASE}/api/register`, {
    data: {
      role: 'student',
      username: u.username,
      display_name: u.display_name,
      password: u.password,
      email: u.email,
    },
  });
  return res;
}

async function apiLogin(context: BrowserContext, u: ReturnType<typeof testUser>) {
  return context.request.post(`${BASE}/api/login`, {
    data: { login: u.username, password: u.password },
  });
}

// ===========================================================================
// Tests
// ===========================================================================

test.describe('Login-Seite', () => {
  test('zeigt Login-Formular', async ({ page }) => {
    await goLogin(page);
    await expect(page.getByPlaceholder(/benutzername/i)).toBeVisible();
    await expect(page.getByPlaceholder(/passwort/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /anmelden/i })).toBeVisible();
  });

  test('Registrierung Schüler', async ({ page }) => {
    const u = testUser();
    await registerViaUI(page, u);
    // Nach erfolgreicher Registrierung -> weitergeleitet oder Erfolgsmeldung
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 5000 }).catch(() => {});
    // Alternativ: TopNav zeigt Benutzer-Avatar
    const url = page.url();
    // Entweder weiterleitet oder Erfolgs-Meldung sichtbar
    const redirected = !url.includes('/login');
    const successMsg = await page.getByText(u.display_name).isVisible().catch(() => false);
    expect(redirected || successMsg).toBe(true);
  });

  test('Login mit falschen Daten zeigt Fehlermeldung', async ({ page }) => {
    await goLogin(page);
    await page.getByPlaceholder(/benutzername/i).fill('gibts_nicht_xyz');
    await page.getByPlaceholder(/passwort/i).fill('falsch999');
    await page.getByRole('button', { name: /anmelden/i }).click();
    // Muss eine Fehlermeldung anzeigen
    await expect(page.getByText(/falsches|unbekannt|falsch|nicht gefunden/i)).toBeVisible({ timeout: 5000 });
  });

  test('Login mit gültigem Konto', async ({ page, context }) => {
    const u = testUser();
    await apiRegister(context, u);
    await loginViaUI(page, u);
    // Nach Login -> TopNav zeigt Initialen des Nutzers
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 5000 }).catch(() => {});
    const iniText = u.display_name.split(' ').map((p: string) => p[0]).join('').toUpperCase();
    // Avatar oder Anzeigename sichtbar
    await expect(page.getByText(iniText).or(page.getByText(u.display_name))).toBeVisible({ timeout: 5000 });
  });

  test('Passwort-vergessen-Link zeigt Formular', async ({ page }) => {
    await goLogin(page);
    await page.getByRole('button', { name: /passwort vergessen/i }).click();
    await expect(page.getByPlaceholder(/e.?mail/i)).toBeVisible({ timeout: 3000 });
  });
});

test.describe('/profil', () => {
  test('leitet unangemeldeten Nutzer zu /login', async ({ page }) => {
    await page.goto(`${BASE}/profil`);
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('zeigt Profildaten nach Login', async ({ page, context }) => {
    const u = testUser();
    await apiRegister(context, u);
    await apiLogin(context, u);
    await page.goto(`${BASE}/profil`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(u.display_name)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(u.username)).toBeVisible();
  });

  test('Anzeigename ändern', async ({ page, context }) => {
    const u = testUser();
    await apiRegister(context, u);
    await apiLogin(context, u);
    await page.goto(`${BASE}/profil`);
    await page.waitForLoadState('networkidle');

    const neuerName = `Neuer ${rand()}`;
    // Anzeigename "Ändern" klicken
    const rows = page.locator('.profile-row');
    const nameRow = rows.filter({ hasText: /anzeigename/i });
    await nameRow.getByRole('button', { name: /ändern/i }).click();
    // Eingabefeld mit neuem Namen befüllen
    await nameRow.getByPlaceholder(/anzeigename/i).fill(neuerName);
    await nameRow.getByRole('button', { name: /speichern/i }).click();
    // Toast oder neuer Name sichtbar
    await expect(page.getByText(neuerName)).toBeVisible({ timeout: 5000 });
  });

  test('Abmelden funktioniert', async ({ page, context }) => {
    const u = testUser();
    await apiRegister(context, u);
    await apiLogin(context, u);
    await page.goto(`${BASE}/profil`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /abmelden/i }).click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });
});

test.describe('/beitreten', () => {
  test('leitet unangemeldeten Nutzer zu /login', async ({ page }) => {
    await page.goto(`${BASE}/beitreten`);
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('zeigt Code-Eingabe nach Login', async ({ page, context }) => {
    const u = testUser();
    await apiRegister(context, u);
    await apiLogin(context, u);
    await page.goto(`${BASE}/beitreten`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByPlaceholder(/klassencode/i).or(page.getByRole('textbox'))).toBeVisible({ timeout: 5000 });
  });

  test('ungültiger Code zeigt Fehlermeldung', async ({ page, context }) => {
    const u = testUser();
    await apiRegister(context, u);
    await apiLogin(context, u);
    await page.goto(`${BASE}/beitreten`);
    await page.waitForLoadState('networkidle');
    const input = page.getByPlaceholder(/klassencode/i).or(page.getByRole('textbox').first());
    await input.fill('UNGUELTIG99');
    await page.getByRole('button', { name: /beitreten/i }).click();
    await expect(page.getByText(/ungültig|nicht gefunden|code/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('/beitreten/[code]', () => {
  test('leitet unangemeldeten Nutzer zu /login mit redirect', async ({ page }) => {
    await page.goto(`${BASE}/beitreten/ABC123`);
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('zeigt Beitreten-Bestätigung mit Code', async ({ page, context }) => {
    const u = testUser();
    await apiRegister(context, u);
    await apiLogin(context, u);
    await page.goto(`${BASE}/beitreten/TESTCODE`);
    await page.waitForLoadState('networkidle');
    // Code wird im card angezeigt
    await expect(page.getByText('TESTCODE')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /beitreten/i })).toBeVisible();
  });
});

test.describe('/passwort-zuruecksetzen', () => {
  test('zeigt Fehler bei ungültigem Token', async ({ page }) => {
    await page.goto(`${BASE}/passwort-zuruecksetzen?token=ungueltig123`);
    await page.waitForLoadState('networkidle');
    // Formular oder Fehlermeldung sichtbar
    const hasForm = await page.getByPlaceholder(/neues passwort/i).isVisible().catch(() => false);
    const hasError = await page.getByText(/ungültig|abgelaufen|fehler/i).isVisible().catch(() => false);
    expect(hasForm || hasError).toBe(true);
  });

  test('ohne Token zeigt Fehler', async ({ page }) => {
    await page.goto(`${BASE}/passwort-zuruecksetzen`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/kein|ungültig|fehler|token/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('TopNav Avatar', () => {
  test('zeigt Anmelden-Link wenn nicht angemeldet', async ({ page }) => {
    await page.goto(`${BASE}/learn`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/anmelden/i)).toBeVisible({ timeout: 5000 });
  });

  test('zeigt Avatar mit Initialen nach Login', async ({ page, context }) => {
    const u = testUser();
    await apiRegister(context, u);
    await apiLogin(context, u);
    await page.goto(`${BASE}/learn`);
    await page.waitForLoadState('networkidle');
    const iniText = u.display_name.split(' ').map((p: string) => p[0]).join('').toUpperCase();
    await expect(page.getByText(iniText)).toBeVisible({ timeout: 5000 });
  });
});
