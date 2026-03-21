# Voice Agent Orchestrator

Control plane for managing PAIA (Project Assurance Interview Agent) voice agent containers. Handles warm pool lifecycle, session assignment from the Discovery platform, real-time monitoring, and agent observability.

## Architecture

```
Discovery Platform                Voice Agent Orchestrator              Docker
─────────────────         ─────────────────────────────────      ──────────────────
                           ┌─────────────────────────────┐
POST /api/sessions ──────> │  Next.js API Routes         │
                           │  (bearer token auth)        │
                           └──────────┬──────────────────┘
                                      │
                           ┌──────────▼──────────────────┐
                           │  Pool Manager (singleton)    │──────> docker.sock
                           │  - Health checks (10s)       │       ┌──────────┐
                           │  - Reconciliation (30s)      │──────>│ Agent 1  │:8888
                           │  - Warm pool auto-scaling    │       │ (warm)   │
                           └──────────┬──────────────────┘       └──────────┘
                                      │                           ┌──────────┐
                           ┌──────────▼──────────────────┐──────>│ Agent 2  │:8888
                           │  Supabase (Postgres 17)      │       │ (active) │
                           │  - pool_agents               │       └──────────┘
                           │  - voice_sessions            │       ┌──────────┐
                           │  - session_events            │──────>│ Agent 3  │:8888
                           │  + Realtime subscriptions    │       │ (warm)   │
                           └─────────────────────────────┘       └──────────┘
```

**Agent containers** run the `paia-local-audio` Docker image with `PAIA_WARM_POOL=1`. Each exposes a FastAPI control plane on port 8888 (`/health`, `/assign`, `/stop`, `/status`). The orchestrator assigns sessions by POSTing to `/assign`, then the agent joins the Teams meeting and runs the interview autonomously.

## Tech Stack

- **Next.js 15** (App Router, server components, server actions)
- **Supabase** (Postgres 17, Realtime, Auth)
- **dockerode** (Docker container management)
- **TanStack Query** (client-side data management)
- **Recharts** (latency dashboard charts)
- **Tailwind CSS 4** + shadcn patterns
- **Pino** (structured logging)
- **Zod** (schema validation)
- **Playwright** (E2E testing)

Follows the [Discovery platform](https://github.com/leafcutter-au/discovery) conventions: 3-layer service architecture (`server-actions` -> `service` -> `api`), `enhanceAction` wrapper, feature-based directory structure.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop
- Supabase CLI (`pnpm add -g supabase`)
- The `paia-local-audio` agent image (built from the [assurance-agent](https://github.com/leafcutter-au/assurance-agent) repo)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment config
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Start local Supabase
supabase start

# Apply migrations
supabase db push

# Generate TypeScript types (after migrations)
pnpm db:generate-types

# Create Docker network for agent communication
docker network create paia-network
```

### Running

The orchestrator runs in Docker via Docker Compose:

```bash
# Build and start the orchestrator
docker compose build
docker compose up -d

# View orchestrator logs
docker compose logs -f
```

The dashboard is available at `http://localhost:3000`. Log in with the credentials configured in your Supabase instance.

For local development without Docker:

```bash
pnpm dev
```

### Shutting Down

```bash
# Stop the orchestrator
docker compose down

# Stop and remove all agent containers
docker ps --filter "name=paia-agent" -q | xargs -r docker rm -f

# Stop Supabase (optional)
supabase stop
```

### Running Tests

```bash
# Run all Playwright E2E tests (requires orchestrator + Supabase running)
npx playwright test

# Run agent detail tests only
npx playwright test e2e/agent-detail.spec.ts
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | Required |
| `API_SECRET_KEY` | Bearer token for machine-to-machine API auth | Required |
| `DOCKER_SOCKET` | Docker socket path | `/var/run/docker.sock` |
| `POOL_MIN_WARM` | Minimum warm agents to maintain | `2` |
| `POOL_WARM_RATIO` | Warm agents as ratio of active | `0.3` |
| `POOL_BUFFER` | Extra warm agents before scale-down | `1` |
| `POOL_MAX_IDLE_MINS` | Max idle time before replacing warm agent | `30` |
| `POOL_IMAGE` | Docker image for agent containers | `paia-local-audio:latest` |
| `POOL_NETWORK` | Docker network name | `paia-network` |

## API

Full API specification with request/response schemas: **[docs/API_SPEC.md](docs/API_SPEC.md)**

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions` | Create an interview session and assign a warm agent |
| `GET` | `/api/sessions` | List recent sessions |
| `GET` | `/api/sessions/:id` | Get session detail with results |
| `POST` | `/api/webhooks/voice-agent` | Agent callback (receives interview results) |
| `GET` | `/api/pool` | Pool status and agent list |
| `POST` | `/api/pool/reconcile` | Trigger manual pool reconciliation |
| `GET` | `/api/pool/:agentId/status` | Live interview progress (proxied from agent) |
| `GET` | `/api/pool/:agentId/logs` | SSE-streamed container logs |
| `GET` | `/api/pool/:agentId/pipecat-logs` | Pipecat framework logs (via Docker exec) |
| `GET` | `/api/pool/:agentId/latency` | Per-turn latency breakdown |
| `GET` | `/api/pool/:agentId/interview-results` | Interview results from container |
| `GET` | `/api/pool/:agentId/stats` | Container CPU/memory/network usage |
| `GET` | `/api/pool/:agentId/audio` | PulseAudio routing diagnostics |

All endpoints require `Authorization: Bearer <API_SECRET_KEY>`. Agent detail endpoints also accept Supabase session cookies for browser access.

## Dashboard

The web UI at `http://localhost:3000/home` provides:

- **Dashboard** (`/home`) — active sessions, warm agents, pool utilization, recent sessions
- **Agent Pool** (`/home/pool`) — container table with status badges, scale up/down controls, stop/delete actions per agent
- **Agent Detail** (`/home/pool/:id`) — tabbed view:
  - **Overview** — live interview topic progress, interview config panel
  - **Logs** — SSE-streamed container logs, on-demand pipecat logs
  - **Performance** — per-turn latency charts (STT, LLM TTFT, LLM gen, TTS)
  - **Diagnostics** — CPU/memory gauges, PulseAudio routing inspector
- **Sessions** (`/home/sessions`) — filterable session list with status, stakeholder, duration
- **Session Detail** (`/home/sessions/:id`) — event timeline, results panel

All views update in real-time via Supabase Realtime subscriptions.

## Project Structure

```
src/
  app/
    api/
      pool/                         # Pool status API
        [agentId]/                   # Agent detail APIs (status, logs, latency, etc.)
      sessions/                     # Session CRUD API
        [sessionId]/                # Session detail API
      webhooks/                     # Agent callback webhook
    auth/                           # Supabase email/password login
    home/
      pool/
        [agentId]/                  # Agent detail page
  features/
    pool/
      components/
        pool-overview.tsx           # Pool table with actions
        agent-detail.tsx            # Agent detail tabbed view
        agent-actions.tsx           # Stop/Delete buttons
        container-logs.tsx          # SSE log viewer
        pipecat-logs-panel.tsx      # On-demand pipecat logs
        latency-dashboard.tsx       # Recharts latency charts
        agent-topic-progress.tsx    # Live interview progress
        interview-config-panel.tsx  # Config display
        resource-usage.tsx          # CPU/memory/network gauges
        audio-health.tsx            # PulseAudio routing inspector
      pool.service.ts               # Pool operations + Docker exec
      pool.api.ts                   # Supabase queries
      pool.schema.ts                # Zod schemas
      server-actions.ts             # Server actions (scale, stop, destroy)
    sessions/                       # Session lifecycle (service, api, schema, components)
    dashboard/                      # Dashboard data loading and components
  hooks/
    use-realtime.ts                 # Supabase Realtime subscription
    use-container-logs.ts           # SSE log streaming hook
    use-agent-status.ts             # Agent status polling hook
    use-agent-latency.ts            # Latency data hook
    use-container-stats.ts          # Container stats polling hook
  lib/
    supabase/                       # Client/server/admin Supabase clients
    docker/                         # dockerode singleton
    actions/                        # enhanceAction wrapper
  middleware.ts                     # Auth protection for /home/*
  instrumentation.ts               # Pool manager startup
e2e/
  orchestrator.spec.ts              # Core E2E tests (auth, dashboard, pool, sessions, API)
  agent-detail.spec.ts              # Agent detail E2E tests (UI, live data, API auth)
supabase/
  migrations/                       # Database schema
docker-compose.yml                  # Orchestrator deployment
Dockerfile                          # Orchestrator image
docs/
  API_SPEC.md                       # Full API specification
```

## Related

- [assurance-agent](https://github.com/leafcutter-au/assurance-agent) — PAIA voice agent (runs inside containers)
- [docs/API_SPEC.md](docs/API_SPEC.md) — Full API specification for integration
