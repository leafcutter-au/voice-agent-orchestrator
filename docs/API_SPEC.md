# Voice Agent Orchestrator — API Specification

**Version:** 1.0
**Base URL:** `http://localhost:3000` (development) or deployed host
**Last updated:** 2026-04-02

## Authentication

All endpoints (except webhooks) require authentication via Bearer token:

```
Authorization: Bearer <API_SECRET_KEY>
```

The `API_SECRET_KEY` is a shared secret configured as an environment variable on the orchestrator. The same key must be configured on any calling service (e.g. Discovery platform).

Agent detail endpoints (`/api/pool/:agentId/*`) also accept Supabase session cookies for browser-based access from the orchestrator dashboard.

---

## Overview

The orchestrator manages a pool of PAIA interview agent containers and exposes APIs for:

1. **Session lifecycle** — create, monitor, stop, and cancel interview sessions
2. **Pool management** — view agent status, trigger scaling
3. **Agent observability** — live logs, interview progress, latency metrics, container diagnostics

### Typical integration flow

```
Discovery                          Orchestrator                    Agent Container
   │                                    │                                │
   │  POST /api/sessions                │                                │
   │  (meeting_url, interview_config)   │                                │
   │ ──────────────────────────────────>│                                │
   │                                    │  POST /assign                  │
   │                                    │ ──────────────────────────────>│
   │  { session_id, status: connecting }│                                │
   │ <──────────────────────────────────│                                │
   │                                    │                                │
   │  GET /api/sessions/:id             │                                │
   │  (poll for status updates)         │                                │
   │ ──────────────────────────────────>│                                │
   │  { status: interviewing, ... }     │                                │
   │ <──────────────────────────────────│                                │
   │                                    │                                │
   │                                    │  POST /api/webhooks/voice-agent│
   │                                    │  (results callback)            │
   │                                    │ <──────────────────────────────│
   │                                    │                                │
   │  POST callback_url                 │                                │
   │  (results forwarded to Discovery)  │                                │
   │ <──────────────────────────────────│                                │
```

---

## Session Endpoints

### POST /api/sessions

Create a new interview session and assign a warm agent.

**Request:**

```json
{
  "meeting_url": "https://teams.microsoft.com/l/meetup-join/...",
  "interview_config": {
    "stakeholder_context": {
      "name": "Jane Doe",
      "role": "Project Manager"
    },
    "interview_settings": {
      "total_max_time_mins": 30,
      "conclusion_buffer_mins": 3
    },
    "interview_framework": [
      {
        "topic": "Project Governance",
        "objective": "Assess governance structure and decision-making processes",
        "target_time_mins": 10,
        "max_time_mins": 15,
        "priority": 1,
        "sub_topics": [
          "Decision authority",
          "Escalation paths",
          "Stakeholder engagement"
        ],
        "guiding_questions": [
          "How are key project decisions made and by whom?",
          "What happens when a decision is escalated?"
        ]
      }
    ],
    "bot_identity": {
      "persona_name": "Claudia"
    },
    "review_context": {
      "review_type": "project assurance review",
      "project_name": "ERP Replacement Programme"
    }
  },
  "callback_url": "https://discovery.example.com/api/webhooks/voice-agent"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `meeting_url` | string (URL) | Yes | Teams/Zoom/Meet meeting URL for the agent to join |
| `interview_config` | object | Yes | Full interview configuration (see schema below) |
| `interview_config.stakeholder_context` | object | Yes | Interviewee details |
| `interview_config.stakeholder_context.name` | string | Yes | Interviewee name |
| `interview_config.stakeholder_context.role` | string | Yes | Interviewee role/title |
| `interview_config.interview_settings` | object | Yes | Time management settings |
| `interview_config.interview_settings.total_max_time_mins` | number | Yes | Maximum total interview duration |
| `interview_config.interview_settings.conclusion_buffer_mins` | number | Yes | Buffer time for wrapping up |
| `interview_config.interview_framework` | array | Yes | Topics to cover (min 1) |
| `interview_config.interview_framework[].topic` | string | Yes | Topic name |
| `interview_config.interview_framework[].objective` | string | Yes | What to assess |
| `interview_config.interview_framework[].target_time_mins` | number | Yes | Target time for this topic |
| `interview_config.interview_framework[].max_time_mins` | number | Yes | Maximum time before moving on |
| `interview_config.interview_framework[].priority` | integer | Yes | Priority order (1 = highest) |
| `interview_config.interview_framework[].sub_topics` | string[] | Yes | Specific areas to probe (min 1) |
| `interview_config.interview_framework[].guiding_questions` | string[] | No | Specific questions the plan author wants answered during this topic. The agent weaves these into the conversation naturally alongside sub-topic exploration. When omitted, the agent explores sub-topics with self-generated questions. |
| `interview_config.bot_identity` | object | No | Agent verbal identity settings. If omitted, defaults apply. |
| `interview_config.bot_identity.persona_name` | string | Yes (if `bot_identity` provided) | Name the agent uses to introduce itself verbally (default: "Claudia") |
| `interview_config.review_context` | object | No | Review framing settings. If omitted, defaults apply. |
| `interview_config.review_context.review_type` | string | Yes (if `review_context` provided) | Type of engagement — e.g. "stage gate review", "health check" (default: "project assurance review") |
| `interview_config.review_context.project_name` | string or null | Yes (if `review_context` provided) | Project/programme name. If null or omitted, no project name is mentioned in the interview. |
| `callback_url` | string (URL) | No | URL to receive results when interview completes. Defaults to orchestrator's own webhook. |

**Response (200):**

```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "connecting"
}
```

**Response (503) — No warm agents available:**

```json
{
  "error": "no_warm_agents",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

The session is created in the database but no agent was assigned. The pool will auto-scale and the session can be retried. The `session_id` is returned so the caller can track or cancel it.

**Response (400) — Validation error:**

```json
{
  "error": "Validation failed",
  "details": {
    "fieldErrors": {
      "meeting_url": ["Invalid url"]
    },
    "formErrors": []
  }
}
```

---

### GET /api/sessions

List recent sessions, ordered by creation date (newest first).

**Response (200):**

```json
{
  "sessions": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "pool_agent_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "status": "completed",
      "meeting_url": "https://teams.microsoft.com/l/meetup-join/...",
      "interview_config": { ... },
      "stakeholder_name": "Jane Doe",
      "stakeholder_role": "Project Manager",
      "callback_url": "https://discovery.example.com/api/webhooks/voice-agent",
      "started_at": "2026-03-21T10:00:00.000Z",
      "ended_at": "2026-03-21T10:28:45.000Z",
      "duration_seconds": 1725,
      "results": { ... },
      "created_at": "2026-03-21T09:59:50.000Z",
      "updated_at": "2026-03-21T10:28:45.000Z"
    }
  ]
}
```

Returns up to 50 sessions.

---

### GET /api/sessions/:sessionId

Get a single session by ID.

**Response (200):** Single session object (same schema as list items above).

**Response (404):**

```json
{
  "error": "Session not found"
}
```

---

### Session status lifecycle

```
pending → connecting → active → interviewing → completed
                   │                        │
                   └──→ cancelled            └──→ failed
```

| Status | Meaning |
|--------|---------|
| `pending` | Session created, no agent assigned yet |
| `connecting` | Agent assigned and joining the meeting |
| `active` | Agent has joined the meeting |
| `completed` | Interview finished successfully, results available |
| `failed` | Interview failed (agent error, timeout, etc.) |
| `cancelled` | Session cancelled (agent destroyed, manual cancel) |

Note: The `active` → `interviewing` transition happens on the agent side. Poll `GET /api/sessions/:id` or `GET /api/pool/:agentId/status` for real-time progress.

---

## Webhook Endpoint

### POST /api/webhooks/voice-agent

Receives interview results from agent containers. **No authentication required** (internal network only).

Discovery does not call this endpoint — the orchestrator calls it internally. However, if `callback_url` was provided when creating the session, the orchestrator **forwards** the results to that URL with this payload.

If `CALLBACK_AUTH_TOKEN` is configured, the forwarded request includes an `Authorization: Bearer <token>` header. This must match Discovery's `VOICE_AGENT_WEBHOOK_SECRET`. Non-2xx responses from the callback URL are logged as errors.

**Callback payload (forwarded to Discovery):**

```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "results": {
    "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "stakeholder": {
      "name": "Jane Doe",
      "role": "Project Manager"
    },
    "startTime": "2026-03-24T10:00:00.000Z",
    "endTime": "2026-03-24T10:28:45.000Z",
    "total_duration_mins": 28.8,
    "findings_summary": { "...": "..." },
    "transcript": [
      {
        "turn": 1,
        "timestamp": "2026-03-24T10:00:12.340Z",
        "speaker": "interviewer",
        "speaker_name": "Claudia",
        "text": "Good morning Jane, thank you for taking the time..."
      },
      {
        "turn": 2,
        "timestamp": "2026-03-24T10:00:38.120Z",
        "speaker": "interviewee",
        "speaker_name": "Jane Doe",
        "text": "Yeah sure, happy to help."
      }
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string (UUID) | The session that completed |
| `status` | `"completed"` or `"failed"` | Outcome |
| `failure_reason` | string or null | Classifies the failure cause (only when `status` is `"failed"`). See [Failure Reasons](#failure-reasons) below. |
| `results` | object | Interview findings (only on completed). Schema is defined by the agent's report generator. |
| `results.findings_summary` | object | Per-topic structured findings with status, summary, and sub-topic coverage |
| `results.transcript` | array | Timestamped conversation transcript with speaker labels. Each entry has `turn` (int), `timestamp` (ISO 8601), `speaker` (`"interviewer"` or `"interviewee"`), `speaker_name` (string), and `text` (string). |

Discovery should implement a webhook endpoint to receive this callback.

### Failure Reasons

When `status` is `"failed"`, the `failure_reason` field classifies the cause:

| Value | Description |
|-------|-------------|
| `participant_no_show` | Agent joined the meeting and waited the full lobby timeout (15 min) but the participant was never admitted |
| `meeting_join_failed` | Agent couldn't join the meeting (bad URL, Chrome crash, auth failure) |
| `pipeline_error` | Interview started but the Pipecat pipeline crashed |
| `agent_error` | Catch-all for other internal errors (audio routing, config, etc.) |

The `failure_reason` field may be `null` for legacy failures that occurred before this field was introduced.

---

## Pool Endpoints

### GET /api/pool

Get pool status and all agents.

**Response (200):**

```json
{
  "stats": {
    "starting": 0,
    "warm": 2,
    "assigned": 0,
    "joining": 1,
    "in_meeting": 0,
    "interviewing": 1,
    "draining": 0,
    "failed": 0
  },
  "agents": [
    {
      "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "container_id": "edb257325711af17...",
      "container_name": "paia-agent-c486",
      "status": "warm",
      "host_port": null,
      "internal_ip": "172.20.0.6",
      "session_id": null,
      "error_message": null,
      "started_at": "2026-03-21T10:00:00.000Z",
      "assigned_at": null,
      "last_health_check": "2026-03-21T10:05:30.000Z",
      "created_at": "2026-03-21T10:00:00.000Z",
      "updated_at": "2026-03-21T10:05:30.000Z"
    }
  ]
}
```

**Agent status values:**

| Status | Meaning |
|--------|---------|
| `starting` | Container is booting (PulseAudio, Xvfb, etc.) |
| `warm` | Ready to accept a session assignment |
| `assigned` | Session assigned, preparing to join meeting |
| `joining` | Chrome is joining the Teams meeting |
| `in_meeting` | Chrome has joined, audio routing being configured |
| `interviewing` | Pipecat pipeline is running the interview |
| `draining` | Interview complete, agent winding down |
| `failed` | Agent encountered an error |

---

### POST /api/pool/reconcile

Trigger pool reconciliation manually. The pool auto-reconciles every 30 seconds, but this endpoint forces an immediate check.

**Request body:** None

**Response (200):**

```json
{
  "success": true,
  "message": "Reconciliation triggered"
}
```

Reconciliation is fire-and-forget — returns immediately while scaling happens in the background.

---

## Agent Detail Endpoints

All endpoints under `/api/pool/:agentId/` accept both Bearer token auth and Supabase session cookies.

### GET /api/pool/:agentId/status

Proxies the agent container's `/status` endpoint. Returns real-time interview progress.

**Response (200):**

```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "interviewing",
  "current_topic": "Project Governance",
  "topics_covered": ["Scope Definition"],
  "elapsed_secs": 423,
  "topic_status": {
    "Scope Definition": {
      "status": "covered",
      "sub_topics_covered": 3,
      "sub_topics_total": 3,
      "time_spent_secs": 180
    },
    "Project Governance": {
      "status": "in_progress",
      "sub_topics_covered": 1,
      "sub_topics_total": 3,
      "time_spent_secs": 95
    },
    "Risk Management": {
      "status": "pending",
      "sub_topics_covered": 0,
      "sub_topics_total": 4,
      "time_spent_secs": 0
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Active session ID |
| `status` | string | Agent's current status |
| `current_topic` | string or null | Topic currently being discussed |
| `topics_covered` | string[] | Completed topic names |
| `elapsed_secs` | number | Seconds since interview started |
| `topic_status` | object | Per-topic progress details |

**Topic status values:** `pending`, `in_progress`, `covered`, `skipped_time`, `topic_target_reached`, `topic_max_reached`, `interview_ending`

**Response (500):** Agent not found or unreachable.

---

### GET /api/pool/:agentId/logs

Stream container logs via Server-Sent Events (SSE).

**Response:** `Content-Type: text/event-stream`

```
data: {"text":"2026-03-21T10:00:01Z Starting virtual display and audio","stream":"stdout"}

data: {"text":"2026-03-21T10:00:05Z PulseAudio started","stream":"stdout"}

data: {"text":"2026-03-21T10:00:06Z Error loading module","stream":"stderr"}

data: {"closed":true}
```

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Log line (with Docker timestamp prefix) |
| `stream` | `"stdout"` or `"stderr"` | Which stream the line came from |
| `closed` | boolean | Sent when the stream ends (container stopped) |

Returns the last 200 lines on connect, then streams new lines in real time. The stream closes when the client disconnects or the container stops.

Note: `EventSource` cannot send auth headers. This endpoint supports Supabase cookie auth for browser use. For programmatic access, use a fetch-based SSE client with the Bearer token.

---

### GET /api/pool/:agentId/pipecat-logs

Read the Pipecat framework logs from inside the container (via Docker exec).

**Response (200):**

```json
{
  "logs": "2026-03-21 10:05:01.234 | INFO | bot_local:main:42 - Starting pipeline...\n2026-03-21 10:05:02.567 | DEBUG | flows.nodes:create_introduction:15 - Creating introduction node\n..."
}
```

Returns the last 500 lines from `/pipecat/logs/pipecat_*.log` inside the container. Returns empty string if no pipecat logs exist yet (agent hasn't started an interview).

This is an on-demand endpoint (not streaming). Call it to fetch a snapshot of current logs.

---

### GET /api/pool/:agentId/latency

Read per-turn latency data from the container (via Docker exec).

**Response (200):**

```json
{
  "events": [
    {
      "type": "turn",
      "turn": 1,
      "stt_ms": 245,
      "llm_ttft_ms": 380,
      "llm_gen_ms": 1200,
      "tts_ms": 190,
      "total_ms": 2015
    },
    {
      "type": "turn",
      "turn": 2,
      "stt_ms": 198,
      "llm_ttft_ms": 420,
      "llm_gen_ms": 950,
      "tts_ms": 175,
      "total_ms": 1743
    },
    {
      "type": "summary",
      "p50": { "stt": 220, "llm_ttft": 400, "llm_gen": 1075, "tts": 183, "total": 1879 },
      "p95": { "stt": 245, "llm_ttft": 420, "llm_gen": 1200, "tts": 190, "total": 2015 },
      "mean": { "stt": 222, "llm_ttft": 400, "llm_gen": 1075, "tts": 183, "total": 1879 }
    }
  ]
}
```

Reads `/pipecat/logs/latency_*.jsonl` from the container. Each line is a JSON object. Returns empty array if no latency data exists yet.

**Turn event fields:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"turn"` | Per-turn measurement |
| `turn` | number | Turn number (sequential) |
| `stt_ms` | number | Speech-to-text latency |
| `llm_ttft_ms` | number | LLM time to first token |
| `llm_gen_ms` | number | LLM total generation time |
| `tts_ms` | number | Text-to-speech latency |
| `total_ms` | number | Total end-to-end response time |

**Summary event fields:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"summary"` | Aggregate statistics |
| `p50` | object | Median values per component |
| `p95` | object | 95th percentile per component |
| `mean` | object | Mean values per component |

---

### GET /api/pool/:agentId/interview-results

Read the interview results JSON from inside the container (via Docker exec).

**Response (200):**

```json
{
  "results": {
    "summary": "The project governance structure is well-defined...",
    "findings": [
      {
        "topic": "Project Governance",
        "rating": "adequate",
        "observations": ["Clear decision authority defined", "Escalation paths documented"],
        "risks": ["Single point of failure in approval chain"]
      }
    ],
    "recommendations": [
      "Consider establishing a secondary approval authority"
    ]
  }
}
```

Returns `null` if no results file exists yet (interview not complete).

Note: Results are also delivered via the callback URL if one was configured. This endpoint reads directly from the container filesystem and is primarily for debugging.

---

### GET /api/pool/:agentId/stats

Get container resource usage (one-shot Docker stats snapshot).

**Response (200):**

```json
{
  "cpu_percent": 12.5,
  "memory_usage_mb": 485,
  "memory_limit_mb": 7936,
  "network_rx_mb": 2.34,
  "network_tx_mb": 1.12
}
```

| Field | Type | Description |
|-------|------|-------------|
| `cpu_percent` | number | Current CPU usage (% of all cores) |
| `memory_usage_mb` | number | Current memory usage in MB |
| `memory_limit_mb` | number | Container memory limit in MB |
| `network_rx_mb` | number | Total network received in MB |
| `network_tx_mb` | number | Total network transmitted in MB |

---

### GET /api/pool/:agentId/audio

Inspect PulseAudio routing inside the container (via Docker exec).

**Response (200):**

```json
{
  "pulseaudio_running": true,
  "sinks": [
    {
      "id": "1",
      "name": "virtual_speaker",
      "module": "module-null-sink.c",
      "state": "RUNNING"
    },
    {
      "id": "2",
      "name": "bot_output",
      "module": "module-null-sink.c",
      "state": "RUNNING"
    }
  ],
  "sources": [
    {
      "id": "1",
      "name": "virtual_speaker.monitor",
      "module": "module-null-sink.c",
      "state": "RUNNING"
    },
    {
      "id": "2",
      "name": "echo_cancelled",
      "module": "module-echo-cancel.c",
      "state": "RUNNING"
    }
  ],
  "sink_inputs": [
    {
      "id": "0",
      "name": "1",
      "module": "protocol-native.c",
      "state": "RUNNING"
    }
  ],
  "source_outputs": [
    {
      "id": "0",
      "name": "1",
      "module": "protocol-native.c",
      "state": "RUNNING"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `pulseaudio_running` | boolean | Whether PulseAudio daemon is alive |
| `sinks` | array | Playback devices |
| `sources` | array | Capture devices |
| `sink_inputs` | array | Active playback streams |
| `source_outputs` | array | Active capture streams |

**Device states:** `RUNNING` (audio flowing), `SUSPENDED` (idle, ready), `IDLE`

When `pulseaudio_running` is `false`, all arrays will be empty. Warm agents that haven't joined a meeting will show `virtual_speaker` and `virtual_mic` as `SUSPENDED` — this is normal.

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Invalid request body or parameters |
| 401 | Missing or invalid authentication |
| 404 | Resource not found |
| 500 | Internal server error (agent unreachable, Docker error, etc.) |
| 503 | Service unavailable (no warm agents for session creation) |

---

## Environment Variables

The orchestrator requires the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `API_SECRET_KEY` | Shared secret for Bearer token auth (Discovery → Orchestrator) | Required |
| `CALLBACK_AUTH_TOKEN` | Bearer token sent with callback forwarding (Orchestrator → Discovery). Must match Discovery's `VOICE_AGENT_WEBHOOK_SECRET`. | Optional |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Required |
| `DOCKER_SOCKET` | Docker socket path | `/var/run/docker.sock` |
| `POOL_MIN_WARM` | Minimum warm agents to maintain | `2` |
| `POOL_WARM_RATIO` | Ratio of warm-to-active agents | `0.3` |
| `POOL_BUFFER` | Extra warm agents above ratio | `1` |
| `POOL_MAX_IDLE_MINS` | Replace warm agents older than this | `30` |
| `POOL_IMAGE` | Docker image for agent containers | `paia-local-audio:latest` |
| `POOL_NETWORK` | Docker network for agent containers | `paia-network` |
| `POOL_ENV_FILE` | Path to agent secrets file | `/etc/paia/agent.env` |

---

## Database Schema

Three tables in Supabase (PostgreSQL):

### voice_sessions

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Session identifier |
| `pool_agent_id` | UUID (FK → pool_agents) | Assigned agent (null if unassigned) |
| `status` | enum | `pending`, `connecting`, `active`, `completed`, `failed`, `cancelled` |
| `meeting_url` | text | Meeting URL |
| `interview_config` | JSONB | Full interview configuration |
| `stakeholder_name` | varchar | Extracted from config |
| `stakeholder_role` | varchar | Extracted from config |
| `callback_url` | text | URL for results delivery |
| `failure_reason` | text | Failure classification (see [Failure Reasons](#failure-reasons)). Null for non-failed sessions. |
| `started_at` | timestamptz | When agent was assigned |
| `ended_at` | timestamptz | When session completed/failed/cancelled |
| `duration_seconds` | integer | Calculated duration |
| `results` | JSONB | Interview findings (on completion) |
| `created_at` | timestamptz | Row creation time |
| `updated_at` | timestamptz | Last update time (auto-trigger) |

### pool_agents

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Agent identifier |
| `container_id` | varchar | Docker container ID |
| `container_name` | varchar | Human-readable name (e.g. `paia-agent-c486`) |
| `status` | enum | `starting`, `warm`, `assigned`, `joining`, `in_meeting`, `interviewing`, `draining`, `failed` |
| `host_port` | integer | Exposed port (if VNC is mapped) |
| `internal_ip` | varchar | Docker network IP |
| `session_id` | UUID (FK → voice_sessions) | Linked session (null if warm) |
| `error_message` | text | Error details (if failed) |
| `started_at` | timestamptz | Container start time |
| `assigned_at` | timestamptz | When session was assigned |
| `last_health_check` | timestamptz | Last successful health check |
| `created_at` | timestamptz | Row creation time |
| `updated_at` | timestamptz | Last update time (auto-trigger) |

### session_events

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Event identifier |
| `session_id` | UUID (FK → voice_sessions) | Parent session |
| `event_type` | varchar | Event name (see below) |
| `event_data` | JSONB | Event-specific payload |
| `created_at` | timestamptz | Event timestamp |

**Event types:** `session_created`, `agent_assigned`, `stop_requested`, `interview_completed`, `interview_failed`, `session_cancelled`, `agent_destroyed`
