import { test, expect } from '@playwright/test';

const API_KEY = 'test-secret-key';
const AUTH_EMAIL = 'admin@test.com';
const AUTH_PASSWORD = 'admin123';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function login(page: import('@playwright/test').Page) {
  await page.goto('/auth/login');
  await page.fill('input[type="email"]', AUTH_EMAIL);
  await page.fill('input[type="password"]', AUTH_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/home', { timeout: 10000 });
}

interface AgentInfo {
  id: string;
  status: string;
  session_id: string | null;
  container_id: string;
}

async function getAgents(
  request: import('@playwright/test').APIRequestContext,
): Promise<AgentInfo[]> {
  const resp = await request.get('/api/pool', {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (resp.status() !== 200) return [];
  const body = await resp.json();
  return body.agents as AgentInfo[];
}

async function getFirstAgentId(
  request: import('@playwright/test').APIRequestContext,
): Promise<string | null> {
  const agents = await getAgents(request);
  return agents.length > 0 ? agents[0].id : null;
}

async function getAgentWithSession(
  request: import('@playwright/test').APIRequestContext,
): Promise<AgentInfo | null> {
  const agents = await getAgents(request);
  return agents.find((a) => a.session_id !== null) ?? null;
}

// ─── Pool Table Enhancements ────────────────────────────────────────────────

test.describe('Pool Table — Actions Column', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('pool table includes Actions column header', async ({ page }) => {
    await page.goto('/home/pool');
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();
  });

  test('agent names in pool table are links', async ({ page, request }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    await page.goto('/home/pool');
    const agentLink = page.locator(`a[href="/home/pool/${agentId}"]`);
    await expect(agentLink).toBeVisible({ timeout: 10000 });
  });

  test('clicking agent name navigates to detail page', async ({
    page,
    request,
  }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    await page.goto('/home/pool');
    const agentLink = page.locator(`a[href="/home/pool/${agentId}"]`);
    await agentLink.click();
    await expect(page).toHaveURL(`/home/pool/${agentId}`, { timeout: 10000 });
  });

  test('each agent row has a delete button', async ({ page, request }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    await page.goto('/home/pool');
    await expect(page.locator('button[title="Delete agent"]').first()).toBeVisible({ timeout: 10000 });
  });
});

// ─── Agent Detail Page — Structure ──────────────────────────────────────────

test.describe('Agent Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('detail page renders header and info cards', async ({
    page,
    request,
  }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    await page.goto(`/home/pool/${agentId}`);

    // Back link
    await expect(page.locator('main a[href="/home/pool"]')).toBeVisible();

    // Info cards
    const main = page.locator('main');
    await expect(main.getByText('Container ID')).toBeVisible();
    await expect(main.getByText('Internal IP')).toBeVisible();
    await expect(main.getByText('Session', { exact: true })).toBeVisible();
    await expect(main.getByText('Uptime')).toBeVisible();
    await expect(main.getByText('Last Health Check')).toBeVisible();
    await expect(main.getByText('VNC')).toBeVisible();
  });

  test('detail page has tabbed navigation', async ({ page, request }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    await page.goto(`/home/pool/${agentId}`);
    await expect(page.locator('button:has-text("Overview")')).toBeVisible();
    await expect(page.locator('button:has-text("Logs")')).toBeVisible();
    await expect(page.locator('button:has-text("Performance")')).toBeVisible();
    await expect(page.locator('button:has-text("Diagnostics")')).toBeVisible();
  });

  test('back link returns to pool overview', async ({ page, request }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    await page.goto(`/home/pool/${agentId}`);
    await page.click('main a[href="/home/pool"]');
    await expect(page).toHaveURL('/home/pool');
  });

  test('delete button is always visible', async ({ page, request }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    await page.goto(`/home/pool/${agentId}`);
    await expect(page.locator('button:has-text("Delete")')).toBeVisible();
  });

  test('nonexistent agent returns 404', async ({ page }) => {
    const resp = await page.goto('/home/pool/00000000-0000-0000-0000-000000000000');
    expect(resp?.status()).toBe(404);
  });
});

// ─── Agent Detail — Live Data Integration ───────────────────────────────────

test.describe('Agent Detail — Live Data', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Overview tab: interview progress loads data (not stuck on spinner)', async ({
    page,
    request,
  }) => {
    const agent = await getAgentWithSession(request);
    if (!agent) {
      test.skip();
      return;
    }

    await page.goto(`/home/pool/${agent.id}`);

    // Should NOT stay on "Loading..." — should resolve to either topic data or "No topics tracked yet."
    await expect(page.locator('text=Interview Progress')).toBeVisible();

    // Wait for loading spinner to disappear — data has loaded
    await expect(page.getByText('Loading...').first()).not.toBeVisible({ timeout: 15000 });
  });

  test('Overview tab: interview config renders stakeholder and topics', async ({
    page,
    request,
  }) => {
    const agent = await getAgentWithSession(request);
    if (!agent) {
      test.skip();
      return;
    }

    await page.goto(`/home/pool/${agent.id}`);

    // Interview config panel should be visible with actual content
    await expect(page.getByRole('heading', { name: 'Interview Config' })).toBeVisible();
    // Should show the Stakeholder section
    await expect(page.getByText('Stakeholder').first()).toBeVisible({ timeout: 5000 });
    // Should show the Topics section
    await expect(page.getByText('Topics').first()).toBeVisible({ timeout: 5000 });
    // Copy JSON button should exist
    await expect(page.getByText('Copy JSON')).toBeVisible();
  });

  test('Logs tab: container logs connect via SSE', async ({
    page,
    request,
  }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    await page.goto(`/home/pool/${agentId}`);
    await page.click('button:has-text("Logs")');

    await expect(page.getByRole('heading', { name: 'Container Logs' })).toBeVisible();

    // The SSE connection indicator should turn green (connected)
    // Give it time to connect and receive initial tail
    await expect(page.getByTitle('Connected')).toBeVisible({ timeout: 10000 });

    // Should see actual log lines (not just "Waiting for log output...")
    await expect(page.getByText('Waiting for log output...')).not.toBeVisible();
  });

  test('Diagnostics tab: resource usage loads CPU/memory data', async ({
    page,
    request,
  }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    await page.goto(`/home/pool/${agentId}`);
    await page.click('button:has-text("Diagnostics")');

    await expect(page.getByRole('heading', { name: 'Resource Usage' })).toBeVisible();

    // Should load actual stats — look for CPU/Memory/Network indicators
    await expect(page.getByText('CPU').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Memory').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Network').first()).toBeVisible({ timeout: 5000 });

    // Verify it actually shows data (memory values contain "MB")
    await expect(page.getByText(/\d+.*MB/).first()).toBeVisible({ timeout: 5000 });

    // Should NOT show "Loading stats..." or error message
    await expect(page.getByText('Loading stats...')).not.toBeVisible();
    await expect(page.getByText('Could not fetch container stats.')).not.toBeVisible();
  });

  test('Diagnostics tab: audio routing loads or shows PulseAudio message', async ({
    page,
    request,
  }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    await page.goto(`/home/pool/${agentId}`);
    await page.click('button:has-text("Diagnostics")');

    await expect(page.getByRole('heading', { name: 'Audio Routing' })).toBeVisible();

    // Click Load button
    const loadButton = page.locator('button').filter({ hasText: 'Load' }).last();
    await loadButton.click();

    // Should show either audio devices, PA not running message, or PA running but no devices
    // (NOT stay on "Click Load to inspect...")
    await expect(
      page.getByText('PulseAudio is not running')
        .or(page.getByText('Sinks (Playback)'))
        .or(page.getByText('no devices are loaded'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('Logs tab: pipecat logs load button works', async ({
    page,
    request,
  }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    await page.goto(`/home/pool/${agentId}`);
    await page.click('button:has-text("Logs")');

    // Find the pipecat logs heading — then locate its sibling refresh/load button
    await expect(page.getByRole('heading', { name: 'Pipecat Logs' })).toBeVisible();

    // The Pipecat Logs panel has a "Load" button in its header bar
    // Find the button that's adjacent to the Pipecat Logs heading
    const pipecatHeader = page.getByRole('heading', { name: 'Pipecat Logs' }).locator('..');
    const loadButton = pipecatHeader.locator('button');
    await loadButton.click();

    // After loading, the prompt text should go away
    await expect(page.getByText('Click "Load" to fetch pipecat')).not.toBeVisible({ timeout: 15000 });
  });
});

// ─── Agent Detail API Routes — Auth ─────────────────────────────────────────

test.describe('Agent Detail API Routes', () => {
  test('GET /api/pool/:id/status returns 401 without auth', async ({
    request,
  }) => {
    const resp = await request.get(
      '/api/pool/00000000-0000-0000-0000-000000000000/status',
    );
    expect(resp.status()).toBe(401);
  });

  test('GET /api/pool/:id/logs returns 401 without auth', async ({
    request,
  }) => {
    const resp = await request.get(
      '/api/pool/00000000-0000-0000-0000-000000000000/logs',
    );
    expect(resp.status()).toBe(401);
  });

  test('GET /api/pool/:id/pipecat-logs returns 401 without auth', async ({
    request,
  }) => {
    const resp = await request.get(
      '/api/pool/00000000-0000-0000-0000-000000000000/pipecat-logs',
    );
    expect(resp.status()).toBe(401);
  });

  test('GET /api/pool/:id/latency returns 401 without auth', async ({
    request,
  }) => {
    const resp = await request.get(
      '/api/pool/00000000-0000-0000-0000-000000000000/latency',
    );
    expect(resp.status()).toBe(401);
  });

  test('GET /api/pool/:id/interview-results returns 401 without auth', async ({
    request,
  }) => {
    const resp = await request.get(
      '/api/pool/00000000-0000-0000-0000-000000000000/interview-results',
    );
    expect(resp.status()).toBe(401);
  });

  test('GET /api/pool/:id/stats returns 401 without auth', async ({
    request,
  }) => {
    const resp = await request.get(
      '/api/pool/00000000-0000-0000-0000-000000000000/stats',
    );
    expect(resp.status()).toBe(401);
  });

  test('GET /api/pool/:id/audio returns 401 without auth', async ({
    request,
  }) => {
    const resp = await request.get(
      '/api/pool/00000000-0000-0000-0000-000000000000/audio',
    );
    expect(resp.status()).toBe(401);
  });

  test('API routes return 200 for real agent with Bearer auth', async ({
    request,
  }) => {
    const agentId = await getFirstAgentId(request);
    if (!agentId) {
      test.skip();
      return;
    }

    const headers = { Authorization: `Bearer ${API_KEY}` };

    const statusResp = await request.get(`/api/pool/${agentId}/status`, { headers });
    expect(statusResp.status()).toBe(200);
    const statusBody = await statusResp.json();
    expect(statusBody).toHaveProperty('status');

    const statsResp = await request.get(`/api/pool/${agentId}/stats`, { headers });
    expect(statsResp.status()).toBe(200);
    const statsBody = await statsResp.json();
    expect(statsBody).toHaveProperty('cpu_percent');
    expect(statsBody).toHaveProperty('memory_usage_mb');

    const audioResp = await request.get(`/api/pool/${agentId}/audio`, { headers });
    expect(audioResp.status()).toBe(200);
    const audioBody = await audioResp.json();
    expect(audioBody).toHaveProperty('sinks');
    expect(audioBody).toHaveProperty('sources');

    const latencyResp = await request.get(`/api/pool/${agentId}/latency`, { headers });
    expect(latencyResp.status()).toBe(200);
    const latencyBody = await latencyResp.json();
    expect(latencyBody).toHaveProperty('events');

    const pipecatResp = await request.get(`/api/pool/${agentId}/pipecat-logs`, { headers });
    expect(pipecatResp.status()).toBe(200);
    const pipecatBody = await pipecatResp.json();
    expect(pipecatBody).toHaveProperty('logs');
  });

  test('API returns error for nonexistent agent with auth', async ({
    request,
  }) => {
    const resp = await request.get(
      '/api/pool/00000000-0000-0000-0000-000000000000/status',
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );
    expect(resp.status()).toBe(500);
  });
});
