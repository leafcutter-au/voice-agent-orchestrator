import { test, expect } from '@playwright/test';

const API_KEY = 'test-secret-key';
const AUTH_EMAIL = 'admin@test.com';
const AUTH_PASSWORD = 'admin123';

// ─── Auth ────────────────────────────────────────────────────────────────────

test.describe('Auth', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('h1')).toContainText('Voice Agent Orchestrator');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrong');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Invalid login credentials')).toBeVisible({
      timeout: 5000,
    });
  });

  test('login with valid credentials redirects to dashboard', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', AUTH_EMAIL);
    await page.fill('input[type="password"]', AUTH_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/home', { timeout: 10000 });
  });
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard loads with stats cards', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('main h1')).toContainText('Dashboard');
    await expect(page.locator('text=Active Sessions')).toBeVisible();
    await expect(page.locator('text=Warm Agents')).toBeVisible();
    await expect(page.locator('text=Pool Utilization')).toBeVisible();
    await expect(page.locator('text=Avg Duration')).toBeVisible();
  });

  test('dashboard shows recent sessions section', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('text=Recent Sessions')).toBeVisible();
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/home');

    // Navigate to pool
    await page.click('a:has-text("Agent Pool")');
    await expect(page).toHaveURL('/home/pool');
    await expect(page.locator('main h1')).toContainText('Agent Pool');

    // Navigate to sessions
    await page.click('a:has-text("Sessions")');
    await expect(page).toHaveURL('/home/sessions');
    await expect(page.locator('main h1')).toContainText('Sessions');

    // Navigate back to dashboard
    await page.click('a:has-text("Dashboard")');
    await expect(page).toHaveURL('/home');
  });
});

// ─── Pool Page ───────────────────────────────────────────────────────────────

test.describe('Pool Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('pool page loads with status cards and controls', async ({ page }) => {
    await page.goto('/home/pool');
    await expect(page.locator('main h1')).toContainText('Agent Pool');

    // Summary cards
    for (const label of ['Total', 'Warm', 'Busy', 'Starting', 'Failed']) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible();
    }

    // Scale controls
    await expect(page.locator('text=Scale Up')).toBeVisible();
    await expect(page.locator('text=Scale Down')).toBeVisible();
  });

  test('pool page shows agent table headers', async ({ page }) => {
    await page.goto('/home/pool');
    await expect(page.locator('th:has-text("Agent")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("IP")')).toBeVisible();
    await expect(page.locator('th:has-text("Session")')).toBeVisible();
    await expect(page.locator('th:has-text("Uptime")')).toBeVisible();
  });
});

// ─── Sessions Page ───────────────────────────────────────────────────────────

test.describe('Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('sessions page loads with table', async ({ page }) => {
    await page.goto('/home/sessions');
    await expect(page.locator('main h1')).toContainText('Sessions');
    await expect(page.locator('th:has-text("Stakeholder")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Started")')).toBeVisible();
    await expect(page.locator('th:has-text("Duration")')).toBeVisible();
  });
});

// ─── API Routes ──────────────────────────────────────────────────────────────

test.describe('API', () => {
  test('GET /api/sessions returns 401 without auth', async ({ request }) => {
    const resp = await request.get('/api/sessions');
    expect(resp.status()).toBe(401);
  });

  test('GET /api/sessions returns 200 with auth', async ({ request }) => {
    const resp = await request.get('/api/sessions', {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('sessions');
    expect(Array.isArray(body.sessions)).toBe(true);
  });

  test('GET /api/pool returns 401 without auth', async ({ request }) => {
    const resp = await request.get('/api/pool');
    expect(resp.status()).toBe(401);
  });

  test('GET /api/pool returns 200 with auth', async ({ request }) => {
    const resp = await request.get('/api/pool', {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('stats');
    expect(body).toHaveProperty('agents');
  });

  test('POST /api/sessions validates payload', async ({ request }) => {
    const resp = await request.post('/api/sessions', {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { invalid: true },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body).toHaveProperty('error', 'Validation failed');
  });

  test('POST /api/sessions with valid payload creates session', async ({
    request,
  }) => {
    const resp = await request.post('/api/sessions', {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        meeting_url: 'https://teams.microsoft.com/l/meetup-join/test-e2e',
        interview_config: {
          interview_framework: [
            {
              topic: 'E2E Test Topic',
              objective: 'Test objective',
              target_time_mins: 5,
              max_time_mins: 10,
              priority: 1,
              sub_topics: ['sub1'],
            },
          ],
          stakeholder_context: { name: 'E2E Tester', role: 'QA' },
          interview_settings: {
            total_max_time_mins: 10,
            conclusion_buffer_mins: 2,
          },
        },
      },
    });

    // Either 200 (agent assigned) or 503 (no warm agents available)
    expect([200, 503]).toContain(resp.status());
    const body = await resp.json();
    expect(body).toHaveProperty('session_id');
  });

  test('POST /api/webhooks/voice-agent validates payload', async ({
    request,
  }) => {
    const resp = await request.post('/api/webhooks/voice-agent', {
      headers: { 'Content-Type': 'application/json' },
      data: { bad: 'payload' },
    });
    expect(resp.status()).toBe(400);
  });

  test('GET /api/sessions/:id returns 404 for nonexistent', async ({
    request,
  }) => {
    const resp = await request.get(
      '/api/sessions/00000000-0000-0000-0000-000000000000',
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );
    expect(resp.status()).toBe(404);
  });

  test('POST /api/pool/reconcile accepts request', async ({
    request,
  }) => {
    // Reconcile is fire-and-forget — returns immediately
    const resp = await request.post('/api/pool/reconcile', {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('success', true);
  });
});

// ─── Session Detail Page ─────────────────────────────────────────────────────

test.describe('Session Detail', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('session created via API appears in sessions list', async ({
    page,
    request,
  }) => {
    // Create a session via API
    const resp = await request.post('/api/sessions', {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        meeting_url: 'https://teams.microsoft.com/l/meetup-join/test-detail',
        interview_config: {
          interview_framework: [
            {
              topic: 'Detail Test',
              objective: 'Test',
              target_time_mins: 5,
              max_time_mins: 10,
              priority: 1,
              sub_topics: ['sub1'],
            },
          ],
          stakeholder_context: { name: 'Detail Tester', role: 'QA' },
          interview_settings: {
            total_max_time_mins: 10,
            conclusion_buffer_mins: 2,
          },
        },
      },
    });
    const body = await resp.json();
    const sessionId = body.session_id;

    // Navigate to sessions page and look for the session
    await page.goto('/home/sessions');
    await expect(
      page.locator(`text=${sessionId.substring(0, 8)}`),
    ).toBeVisible({ timeout: 10000 });

    // Click into session detail
    await page.click(`text=${sessionId.substring(0, 8)}`);
    await expect(page).toHaveURL(new RegExp(`/home/sessions/${sessionId}`));
    await expect(page.locator('text=Event Timeline')).toBeVisible();
    await expect(page.locator('text=Detail Tester')).toBeVisible();
  });
});

// ─── Sign Out ────────────────────────────────────────────────────────────────

test.describe('Sign Out', () => {
  test('sign out redirects to login', async ({ page }) => {
    await login(page);
    await page.goto('/home');
    await page.click('text=Sign out');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function login(page: import('@playwright/test').Page) {
  await page.goto('/auth/login');
  await page.fill('input[type="email"]', AUTH_EMAIL);
  await page.fill('input[type="password"]', AUTH_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/home', { timeout: 10000 });
}
