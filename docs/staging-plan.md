# Staging Plan: Production Migration

## Target Architecture

```
Hetzner (Coolify)                     Local Docker Host (i9/128GB)
┌──────────────────────┐              ┌─────────────────────────────┐
│ Discovery App        │              │ Cloudflare Tunnel           │
│ Managed Supabase     │◄──callback──│ Orchestrator (docker-compose)│
│ (supabase.com)       │──dispatch──►│ Orchestrator Supabase (local)│
│                      │              │ Agent Pool (paia-network)   │
│ Git CI/CD auto-deploy│              │ Docker Engine               │
└──────────────────────┘              └─────────────────────────────┘
```

---

## Stage 1: Prepare the Local Docker Host

**Goal:** Get the i9 box running orchestrator + agents independently of your MacBook.

### 1.1 Base setup
- [ ] Install Docker Engine + Docker Compose on the i9 (Ubuntu/Debian)
- [ ] Create the agent network: `docker network create paia-network`
- [ ] Install Supabase CLI (`npx supabase init` or brew)
- [ ] Clone the orchestrator repo onto the i9
- [ ] Clone the assurance-agent repo onto the i9

### 1.2 Build the agent image
- [ ] On the i9, build from assurance-agent repo:
  ```bash
  # Build the base meet-teams-bot image first (check agent repo for instructions)
  docker build -f Dockerfile.local-audio -t paia-local-audio:latest .
  ```
- [ ] Verify: `docker images | grep paia-local-audio`

### 1.3 Stand up orchestrator Supabase
- [ ] From the orchestrator repo on i9:
  ```bash
  npx supabase start
  npx supabase db push   # applies all 4 migrations
  ```
- [ ] Note the API URL, anon key, and service role key from `supabase status`
- [ ] No seed data needed — pool and sessions are created at runtime

### 1.4 Configure orchestrator environment
- [ ] Copy `.env.local.example` → `.env.local`, fill in:
  - `NEXT_PUBLIC_SUPABASE_URL` → local Supabase API URL (from supabase status)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → from supabase status
  - `SUPABASE_SERVICE_ROLE_KEY` → from supabase status
  - `API_SECRET_KEY` → generate a strong secret (this is what Discovery will use)
  - `POOL_IMAGE=paia-local-audio:latest`
  - `POOL_MIN_WARM=2` (or whatever you want for testing)
- [ ] Copy `.env.agent.example` → `.env.agent`, fill in API keys:
  - `GOOGLE_API_KEY`, `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`
- [ ] Update `docker-compose.yml` SUPABASE_URL to point to i9's local Supabase
  (likely `http://host.docker.internal:<port>` — check supabase config.toml for the API port)

### 1.5 Start and verify orchestrator
- [ ] `docker compose up -d --build`
- [ ] Check dashboard: `http://<i9-local-ip>:3100`
- [ ] Verify warm pool is spinning up (check Pool page)
- [ ] From your MacBook, confirm you can reach `http://<i9-local-ip>:3100/api/pool`

### 1.6 Quick smoke test (optional)
- [ ] Point your local dev Discovery at the i9 orchestrator:
  - `VOICE_AGENT_ORCHESTRATOR_URL=http://<i9-local-ip>:3100`
  - `VOICE_AGENT_CALLBACK_URL=http://<macbook-local-ip>:3000`
- [ ] Dispatch a test interview, confirm the full flow works over LAN
- [ ] This validates the orchestrator works independently before adding the tunnel

---

## Stage 2: Cloudflare Tunnel on Docker Host

**Goal:** Make the orchestrator reachable from the internet so Coolify-hosted Discovery can call it.

### 2.1 Set up Cloudflare Tunnel
- [ ] Add your domain to Cloudflare (if not already)
- [ ] On the i9, install cloudflared:
  ```bash
  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
  chmod +x /usr/local/bin/cloudflared
  ```
- [ ] Authenticate: `cloudflared tunnel login`
- [ ] Create tunnel: `cloudflared tunnel create paia-orchestrator`
- [ ] Configure tunnel (e.g. `~/.cloudflared/config.yml`):
  ```yaml
  tunnel: <tunnel-id>
  credentials-file: ~/.cloudflared/<tunnel-id>.json
  ingress:
    - hostname: orch.yourdomain.com
      service: http://localhost:3100
    - service: http_status:404
  ```
- [ ] Add DNS: `cloudflared tunnel route dns paia-orchestrator orch.yourdomain.com`
- [ ] Start tunnel: `cloudflared tunnel run paia-orchestrator`
- [ ] Install as systemd service for auto-start:
  ```bash
  cloudflared service install
  ```

### 2.2 Verify tunnel
- [ ] From your MacBook (or phone on mobile data): `curl https://orch.yourdomain.com/api/pool`
  - Should get 401 (no bearer token) — that's correct
- [ ] With token: `curl -H "Authorization: Bearer <API_SECRET_KEY>" https://orch.yourdomain.com/api/pool`
  - Should return pool JSON

### 2.3 Security consideration
- [ ] The `/api/webhooks/voice-agent` endpoint currently has no auth (designed for internal Docker network)
- [ ] Agent containers still call this internally on `paia-network` — no change needed
- [ ] But it's now exposed via tunnel. Consider adding the webhook secret validation
  (or rely on Cloudflare's firewall rules to restrict external access to `/api/webhooks/*`)
- [ ] Cloudflare Access can also add an extra auth layer if desired

---

## Stage 3: Provision Managed Supabase for Discovery

**Goal:** Set up Discovery's production database before deploying the app.

### 3.1 Create Supabase project
- [ ] Go to supabase.com → New Project
- [ ] Region: Choose closest to Hetzner DC (EU likely — Frankfurt or similar)
- [ ] Note: `Project URL`, `anon key`, `service role key`

### 3.2 Push schema
- [ ] From discovery-master/apps/web on your MacBook:
  ```bash
  npx supabase link --project-ref <project-ref>
  npx supabase db push
  ```
- [ ] This applies all 36 migrations

### 3.3 Configure auth
- [ ] In Supabase dashboard → Authentication → Providers:
  - Enable Email (already default)
  - Configure Google OAuth if needed (client ID + secret)
- [ ] Set Site URL to your production Discovery URL (e.g. `https://app.yourdomain.com`)
- [ ] Add redirect URLs for auth callbacks

### 3.4 Seed initial data
- [ ] Review `supabase/seed.sql` — it contains dev webhook triggers pointing to localhost
  - Do NOT run seed as-is in production
- [ ] Create your production user account manually via the Supabase dashboard or sign-up flow
- [ ] If you need Stripe test/prod keys configured, set those up in Supabase vault or env

### 3.5 Database webhooks (if used)
- [ ] Discovery uses Supabase DB webhooks (X-Supabase-Event-Signature)
- [ ] Configure these in Supabase dashboard to point to your production Discovery URL
  (e.g. `https://app.yourdomain.com/api/db/webhook`)

---

## Stage 4: Deploy Discovery to Coolify

**Goal:** Get Discovery running on Coolify with CI/CD from git.

### 4.1 Coolify project setup
- [ ] In Coolify, create a new resource → pick your Hetzner server
- [ ] Source: GitHub repo (discovery-master)
- [ ] Build pack: Nixpacks (auto-detects Next.js) or Dockerfile (you may need to add one)
- [ ] Since there's no Dockerfile, Nixpacks should work. Alternatively, add a Dockerfile
  to the repo based on the standard Next.js standalone pattern

### 4.2 Build configuration
- [ ] Set build command: `pnpm build` (monorepo — ensure Coolify runs from repo root)
- [ ] Set install command: `pnpm install`
- [ ] Base directory: `/` (turbo handles the monorepo)
- [ ] If Coolify needs a specific app directory, try `/apps/web`
- [ ] Output: Next.js standalone (check next.config for `output: 'standalone'`)

### 4.3 Environment variables
Set these in Coolify's environment config:

```bash
# Supabase (from Stage 3)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Voice Agent Orchestrator (from Stage 2)
VOICE_AGENT_ORCHESTRATOR_URL=https://orch.yourdomain.com
VOICE_AGENT_API_KEY=<same API_SECRET_KEY from orchestrator .env.local>
VOICE_AGENT_CALLBACK_URL=https://app.yourdomain.com
VOICE_AGENT_WEBHOOK_SECRET=<generate-a-secret>

# OpenRouter (AI analysis)
OPENROUTER_API_KEY=<key>

# Apify (LinkedIn enrichment, if used)
APIFY_API_TOKEN=<key>

# Stripe (billing)
STRIPE_SECRET_KEY=<key>
STRIPE_WEBHOOK_SECRET=<key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<key>

# Email (configure SMTP or use Supabase's built-in)
EMAIL_HOST=<smtp-host>
EMAIL_PORT=<port>
EMAIL_USER=<user>
EMAIL_PASSWORD=<password>

# Feature flags (enable what you need)
NEXT_PUBLIC_ENABLE_INTERVIEW_PLANNING=true
NEXT_PUBLIC_ENABLE_INTERVIEW_ANALYSIS=true
```

### 4.4 Domain & SSL
- [ ] In Coolify, assign domain: `app.yourdomain.com`
- [ ] Coolify handles Let's Encrypt SSL automatically
- [ ] Add DNS record: `app.yourdomain.com` → Coolify server IP (A record)

### 4.5 CI/CD setup
- [ ] In Coolify, enable "Auto Deploy" on push to `main`
- [ ] Coolify watches the GitHub repo and rebuilds on push
- [ ] Alternatively, use GitHub Actions webhook to trigger Coolify deploy
- [ ] The existing `.github/workflows/workflow.yml` runs typecheck + lint on PR —
  keep this as a quality gate, let Coolify handle the actual deploy on merge

### 4.6 First deploy & verify
- [ ] Trigger deploy in Coolify
- [ ] Watch build logs for errors (common: missing env vars at build time,
  monorepo path issues)
- [ ] Verify: `https://app.yourdomain.com` loads the login page
- [ ] Sign up / create account
- [ ] Check Supabase dashboard — user should appear in auth.users

---

## Stage 5: End-to-End Integration Test

**Goal:** Confirm the full interview flow works across all three environments.

### 5.1 Connectivity checks
- [ ] Discovery (Coolify) can reach orchestrator:
  ```
  From Coolify terminal or logs, verify VOICE_AGENT_ORCHESTRATOR_URL is reachable
  ```
- [ ] Orchestrator (i9) can reach Discovery callback:
  ```
  curl https://app.yourdomain.com/api/version
  ```
- [ ] Orchestrator pool is healthy:
  ```
  Check https://orch.yourdomain.com dashboard — warm agents showing
  ```

### 5.2 Dispatch test interview
- [ ] In Discovery, create an engagement + interview guide
- [ ] Set up a test Teams meeting
- [ ] Dispatch the voice agent
- [ ] Monitor:
  - Discovery UI: session status polling (should show connecting → active)
  - Orchestrator dashboard: agent assigned, joining, in_meeting
  - Teams meeting: bot should join and start interviewing

### 5.3 Verify callback flow
- [ ] After interview completes:
  - Agent POSTs results → orchestrator webhook (internal, paia-network)
  - Orchestrator stores results, then POSTs to Discovery callback URL
  - Discovery receives transcript, updates interview guide status
- [ ] Check Discovery UI: transcript appears, analysis chat works

### 5.4 Failure scenarios to test
- [ ] Kill the tunnel temporarily — Discovery should get connection errors
  (not silent failures). Restart tunnel, verify recovery.
- [ ] Stop an agent mid-interview — orchestrator should detect failure via
  health checks, mark session failed, clean up container
- [ ] Restart orchestrator — pool should reconcile and spin up fresh warm agents

---

## Stage 6: Harden & Operationalize

**Goal:** Make it reliable for ongoing use.

### 6.1 Auto-start on reboot (i9)
- [ ] cloudflared already installed as systemd service (Stage 2)
- [ ] Add orchestrator to auto-start:
  ```bash
  # In orchestrator repo directory
  docker compose up -d  # restart: unless-stopped already set
  ```
- [ ] Add Supabase to auto-start (or switch to managed Supabase for orchestrator too)
- [ ] Consider a simple cron or systemd timer to check tunnel health

### 6.2 Monitoring
- [ ] Set up Cloudflare notifications for tunnel disconnect
- [ ] Simple uptime check on `https://orch.yourdomain.com/api/pool`
  (UptimeRobot, Healthchecks.io, or similar free tier)
- [ ] Discovery: Coolify has built-in health checks and restart policies

### 6.3 Backups
- [ ] Orchestrator Supabase: data is transient (pool state, session records)
  — decide if you need backups or if it's acceptable to lose history
- [ ] Discovery Supabase: managed Supabase includes automatic backups on paid plans
- [ ] Git repos: already on GitHub — that's your backup

### 6.4 Agent image updates
- [ ] When you update the assurance-agent code:
  ```bash
  # On the i9
  cd assurance-agent
  git pull
  docker build -f Dockerfile.local-audio -t paia-local-audio:latest .
  # Orchestrator will use new image for next warm agent spawn
  # Existing agents continue running old image until recycled
  ```
- [ ] Consider a simple deploy script or Makefile for this

### 6.5 Orchestrator updates
- [ ] When you update orchestrator code:
  ```bash
  # On the i9
  cd voice-agent-orchestrator
  git pull
  docker compose up -d --build
  ```
- [ ] Active interviews will be interrupted — do this during quiet periods
- [ ] Pool reconciliation will rebuild warm agents automatically after restart

---

## Quick Reference: What Points Where

| From | To | URL/Address |
|------|----|-------------|
| Discovery → Orchestrator API | `VOICE_AGENT_ORCHESTRATOR_URL` | `https://orch.yourdomain.com` |
| Discovery → Supabase | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| Orchestrator → Discovery callback | `callback_url` (per session) | `https://app.yourdomain.com/api/webhooks/voice-agent` |
| Orchestrator → Supabase | `SUPABASE_URL` | `http://host.docker.internal:<port>` (local) |
| Agent → Orchestrator webhook | hardcoded | `http://paia-orchestrator:3000/api/webhooks/voice-agent` |
| Agent → AI APIs | env vars | Deepgram, Gemini, Cartesia (direct internet) |
| Tunnel | exposes | `localhost:3100` → `https://orch.yourdomain.com` |

---

## Rollback Plan

If anything goes wrong, you can always:
1. Run Discovery locally again (`pnpm dev` on MacBook)
2. Point it at the i9 orchestrator over LAN (`http://<i9-ip>:3100`)
3. Or point it back at localhost if orchestrator is still on MacBook

Nothing is destroyed — the local dev setup remains intact throughout.
