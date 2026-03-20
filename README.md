# Voice Agent Orchestrator

Control plane for managing PAIA (Project Assurance Interview Agent) voice agent containers. Handles warm pool lifecycle, session assignment from the Discovery platform, and real-time monitoring.

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
- **TanStack Query/Table** (client-side data management)
- **Tailwind CSS 4** + shadcn patterns
- **Pino** (structured logging)
- **Zod** (schema validation)

Follows the [Discovery platform](https://github.com/leafcutter-au/discovery) conventions: 3-layer service architecture (`server-actions` -> `service` -> `api`), `enhanceAction` wrapper, feature-based directory structure.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop
- Supabase CLI (`pnpm add -g supabase`)

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

# Start dev server
pnpm dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `API_SECRET_KEY` | Bearer token for machine-to-machine API auth |
| `DOCKER_SOCKET` | Docker socket path (default: `/var/run/docker.sock`) |
| `POOL_MIN_WARM` | Minimum warm agents to maintain (default: `2`) |
| `POOL_WARM_RATIO` | Warm agents as ratio of active (default: `0.3`) |
| `POOL_BUFFER` | Extra warm agents before scale-down (default: `1`) |
| `POOL_MAX_IDLE_MINS` | Max idle time before replacing warm agent (default: `30`) |
| `POOL_IMAGE` | Docker image for agent containers (default: `paia-local-audio:latest`) |
| `POOL_NETWORK` | Docker network name (default: `paia-network`) |

## API

### `POST /api/sessions`

Create a new interview session. Called by the Discovery platform.

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Authorization: Bearer $API_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_url": "https://teams.microsoft.com/l/meetup-join/...",
    "interview_config": {
      "interview_framework": [
        {
          "topic": "Benefits Management",
          "objective": "Assess benefits tracking maturity",
          "target_time_mins": 10,
          "max_time_mins": 15,
          "priority": 1,
          "sub_topics": ["Benefits Definition", "Benefits Tracking"]
        }
      ],
      "stakeholder_context": { "name": "Jane Smith", "role": "Project Manager" },
      "interview_settings": { "total_max_time_mins": 60, "conclusion_buffer_mins": 5 }
    },
    "callback_url": "https://discovery.example.com/webhooks/voice-agent"
  }'
```

**Response:** `{"session_id": "uuid", "status": "connecting"}` (200) or `{"error": "no_warm_agents"}` (503)

### `GET /api/sessions/:id`

Check session status. Returns the full session record including results when completed.

### `POST /api/webhooks/voice-agent`

Callback endpoint hit by agent containers when an interview completes. Receives results, updates session status, and forwards to Discovery's callback URL if configured.

## Dashboard

The web UI at `/home` provides:

- **Dashboard** (`/home`) — active sessions, warm agents, pool utilization, recent sessions
- **Agent Pool** (`/home/pool`) — container grid with status badges, scale up/down controls
- **Sessions** (`/home/sessions`) — filterable session list with status, stakeholder, duration
- **Session Detail** (`/home/sessions/:id`) — live topic progress, event timeline, results panel

All views update in real-time via Supabase Realtime subscriptions.

## Project Structure

```
src/
  app/
    api/                        # External API routes (bearer token auth)
    auth/                       # Supabase email/password login
    home/                       # Authenticated dashboard pages
  features/
    pool/                       # Pool management (service, api, schema, components)
    sessions/                   # Session lifecycle (service, api, schema, components)
    dashboard/                  # Dashboard data loading and components
  lib/
    supabase/                   # Client/server/admin Supabase clients
    docker/                     # dockerode singleton
    actions/                    # enhanceAction wrapper
  hooks/
    use-realtime.ts             # Supabase Realtime subscription hook
  middleware.ts                 # Auth protection for /home/*
  instrumentation.ts            # Pool manager startup
supabase/
  migrations/                   # Database schema
```

## Related

- [assurance-agent](https://github.com/leafcutter-au/assurance-agent) — PAIA voice agent (runs inside containers)
