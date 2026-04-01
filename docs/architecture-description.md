# Lumiar Voice Agent Platform — Architecture Description

## Purpose

This document describes the end-to-end architecture of the Lumiar (Project Assurance Interview Agent) platform. It is intended as input for generating executive-level architecture diagrams.

## System Overview

Lumiar is an AI-powered interview platform that conducts structured stakeholder interviews via voice. A human operator uses the Lumiar web application to plan interviews, configure topic frameworks, and dispatch AI agents. The Voice Agent Orchestrator receives the request, assigns a pre-warmed AI agent from a ready pool, and the agent autonomously joins the video call, conducts the interview, and delivers structured findings back to Lumiar.

The system uses two communication patterns between Lumiar and the Orchestrator: **REST polling** for real-time status updates during the interview, and an **asynchronous webhook callback** to deliver the completed transcript and findings.

The system is designed around a **warm pool** model: AI agent containers are pre-initialised and kept in a ready state so that when an interview is requested, an agent can join the meeting within seconds rather than waiting minutes for cold start.

## Components

### 1. Lumiar (Discovery Master)

Lumiar is a multi-tenant SaaS platform for project assurance practitioners, built on Next.js and Supabase. It manages the full interview lifecycle from planning through to analysis and reporting. Key capabilities relevant to the voice agent integration:

**Interview Planning** — Practitioners manage engagements containing stakeholders, interview guides with structured topic frameworks, and time allocations per topic. Guides define the interview's objectives, questions, and priorities.

**Voice Agent Dispatch** — When a stakeholder's interview guide is finalised and a meeting link is available, Lumiar sends a dispatch request to the Orchestrator containing the meeting URL, interview framework, stakeholder context, interview settings, and a callback URL for results delivery.

**Session Monitoring** — While an interview is in progress, Lumiar polls the Orchestrator's session status API at regular intervals to track the agent's state (connecting, active, interviewing, completed, failed). The operator sees real-time status updates and can access diagnostics including topic progress, per-turn latency, and agent resource usage.

**Transcript Ingestion** — When the interview completes, the Orchestrator calls Lumiar's webhook endpoint with the structured transcript and findings. Lumiar stores the raw JSON transcript, generates a human-readable text version, and automatically creates speaker mappings that link transcript speakers to known stakeholders.

**Analysis Pipeline** — Ingested transcripts feed into an AI-powered analysis pipeline (via OpenRouter LLM) that extracts themes, generates per-topic assessments, and produces report content. This pipeline processes transcripts from both voice agent interviews and manually uploaded transcripts identically.

### 2. Voice Agent Orchestrator

The Orchestrator is the central control plane. It is a Next.js web application backed by a PostgreSQL database (Supabase) and manages the Docker runtime for agent containers. It has three primary responsibilities:

**Session Management** — Receives interview requests from Lumiar, creates session records, and tracks each session through its lifecycle: pending, connecting, active, interviewing, completed, failed, or cancelled. Exposes a status API that Lumiar polls during active interviews.

**Warm Pool Management** — Maintains a pool of pre-initialised agent containers in a "warm" state, ready for immediate assignment. A background reconciliation loop runs every 30 seconds to ensure the pool has enough warm agents based on current demand. A health check loop runs every 10 seconds to monitor each agent's status and detect failures. The pool automatically scales up when interviews are requested and replaces agents that have been idle too long.

**Results Delivery** — When an interview completes, the Orchestrator delivers the full transcript and structured findings to Lumiar's webhook endpoint using a pre-configured callback URL. The callback includes a bearer token for authentication.

**Real-Time Monitoring Dashboard** — Provides a web-based operations dashboard showing pool status, active sessions, agent health, interview progress, performance metrics (per-turn latency breakdown), and container diagnostics.

### 3. Agent Container (Voice Agent)

Each agent is a self-contained Docker container that runs an AI-powered voice interview pipeline. When warm, the container has the following subsystems already initialised and waiting:

**Browser Runtime** — A Chromium browser instance ready to join a video meeting URL. When assigned an interview, it navigates to the Teams or Google Meet link and joins as a named bot participant.

**Virtual Audio System** — PulseAudio virtual devices that route audio between the meeting and the AI pipeline. Meeting participant audio is captured from the browser, passed through WebRTC echo cancellation, and fed to the speech recognition service. The AI's synthesised speech is routed back into the meeting via the browser.

**Pipecat Voice Pipeline** — The core AI engine that orchestrates the interview conversation. It connects three external AI services in a real-time loop:

- **Speech-to-Text (Deepgram)** — Converts the stakeholder's spoken words into text
- **Large Language Model (Google Gemini)** — Reasons about the interview context, generates appropriate questions, and follows the structured interview framework
- **Text-to-Speech (Cartesia)** — Converts the AI's text responses into natural-sounding speech

The pipeline manages natural turn-taking with voice activity detection, navigates the structured topic framework (progressing, pausing, and revisiting topics based on stakeholder responses), enforces time budgets per topic and overall, and generates structured per-topic findings with coverage assessments and a full transcript when the interview concludes.

**Control Plane API** — A lightweight HTTP server (port 8888) that the Orchestrator uses to assign interviews, check health, request graceful stops, and query interview progress. This is only accessible within the internal Docker network.

### 4. Infrastructure Services

**PostgreSQL (Supabase)** — Both Lumiar and the Orchestrator use independent Supabase instances. Lumiar's database stores stakeholders, interview guides, transcripts, speaker mappings, and analysis results. The Orchestrator's database stores session records, pool agent state, session events, and diagnostic data.

**Docker Runtime** — The Orchestrator communicates with the Docker daemon to create, monitor, and destroy agent containers. All containers run on an internal Docker network so the Orchestrator can reach agent control plane APIs without exposing them externally.

## Key Flows

### Interview Lifecycle

1. **Planning** — A practitioner configures an interview guide in Lumiar with structured topics, objectives, time allocations, and guiding questions for a specific stakeholder.

2. **Dispatch** — The practitioner enters a meeting URL and dispatches a voice agent. Lumiar sends the interview configuration to the Orchestrator, which returns a session identifier immediately.

3. **Assignment** — The Orchestrator selects the oldest warm agent from the pool, sends it the meeting URL and interview framework, and marks the session as "connecting". A replacement warm agent begins spinning up immediately.

4. **Joining** — The agent's browser navigates to the meeting URL and joins as a participant. The virtual audio system connects the meeting audio to the AI pipeline.

5. **Interview** — The Pipecat pipeline conducts the structured interview. The LLM follows the configured topic framework, asks probing questions, manages time across topics, and adapts based on stakeholder responses. Lumiar polls the Orchestrator for status updates throughout.

6. **Completion** — When the interview concludes (naturally or via operator stop), the agent generates structured findings per topic and a timestamped transcript. It sends these results back to the Orchestrator via an internal webhook.

7. **Results Delivery** — The Orchestrator stores the results in its database and forwards them to Lumiar's webhook endpoint. Lumiar ingests the transcript, creates speaker mappings, and makes the transcript available for analysis.

8. **Cleanup** — After a 30-second grace period for log collection, the agent container is destroyed and removed from the pool.

### Communication Patterns

Lumiar and the Orchestrator communicate via two distinct patterns:

**Synchronous REST** — Lumiar calls the Orchestrator's API for dispatch, session status polling, agent diagnostics, and pool health checks. These are authenticated with a shared API key.

**Asynchronous Webhook** — The Orchestrator calls Lumiar's webhook endpoint when an interview completes (or fails), delivering the transcript and findings. This is authenticated with a separate webhook secret. The callback URL is configured per-dispatch, allowing different environments (local Docker, remote server, production) to use appropriate network addresses.

### Warm Pool Scaling

The pool maintains a configurable minimum number of warm agents. When agents are assigned to interviews, the reconciliation loop detects the deficit and spawns replacements. Each new container takes approximately 60–90 seconds to initialise (boot OS services, start browser, initialise audio routing, load AI models) before reporting as warm. Because agents are pre-warmed, interview assignment is near-instant from the operator's perspective. Idle agents are periodically replaced to prevent resource staleness.

## Data Flow Summary

```
Lumiar              Orchestrator              Agent Container         AI Services
   |                     |                          |                      |
   |  Dispatch Request   |                          |                      |
   |  (meeting URL,      |                          |                      |
   |   interview config, |                          |                      |
   |   callback URL)     |                          |                      |
   |-------------------->|                          |                      |
   |  Session ID         |                          |                      |
   |<--------------------|                          |                      |
   |                     |  Assign (meeting URL,    |                      |
   |                     |  interview config)       |                      |
   |                     |------------------------->|                      |
   |                     |                          |  Join Meeting        |
   |  Poll Status        |                          |  (Teams/Google Meet) |
   |-------------------->|                          |                      |
   |  Status Response    |                          |                      |
   |<--------------------|                          |  Audio In ---------> | Deepgram (STT)
   |                     |                          |  Text    ---------> | Gemini (LLM)
   |  Poll Status (...)  |                          |  Speech  <--------- | Cartesia (TTS)
   |<------------------->|                          |  Audio Out --------> | Meeting
   |                     |                          |                      |
   |                     |  Results + Transcript    |                      |
   |                     |<-------------------------|                      |
   |  Webhook Callback   |                          |                      |
   |  (transcript,       |                          |                      |
   |   findings)         |                          |                      |
   |<--------------------|                          |                      |
   |                     |  Destroy Container       |                      |
   |  Ingest transcript  |------------------------->|                      |
   |  Create speaker     |                          |                      |
   |  mappings           |                          |                      |
   |  Run AI analysis    |                          |                      |
   |                     |                          |                      |
```

## Deployment Topology

The system can be deployed in several configurations:

**Local Development** — Both Lumiar and the Orchestrator run on the developer's machine. The Orchestrator and agent containers run in Docker. The callback URL uses `host.docker.internal` to bridge from Docker's network to the host's Next.js dev server.

**Remote Orchestrator** — Lumiar runs locally or in production. The Orchestrator and agent pool run on a dedicated Docker server (or cloud VM). The callback URL points to Lumiar's publicly accessible endpoint.

**Full Production** — Both systems deployed to their respective hosting environments with proper DNS, TLS, and network security between them.

## Technology Summary

| Layer | Technology |
|-------|-----------|
| Lumiar (Client) | Next.js 16, React 19, TypeScript, Supabase |
| Analysis Pipeline | OpenRouter (LLM), custom prompt framework |
| Orchestrator | Next.js 15, React 19, TypeScript, Supabase |
| Container Management | Docker, dockerode |
| Agent Runtime | Python (Pipecat framework), Chromium, PulseAudio |
| Speech-to-Text | Deepgram |
| Language Model | Google Gemini |
| Text-to-Speech | Cartesia |
| Meeting Platforms | Microsoft Teams, Google Meet |
| Monitoring | Real-time dashboard with Recharts, TanStack Query |
