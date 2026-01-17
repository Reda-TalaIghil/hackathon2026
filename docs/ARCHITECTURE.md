# System Architecture

## Overview

Flowback is an event-driven feedback platform with the following layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Widget)                          │
│ • Signal Capture (click, hover, scroll, dwell, rage-clicks)  │
│ • Micro-Prompt UI (1-tap reactions)                          │
│ • Consent Management                                         │
│ • Event Queue (offline-first, batched)                       │
└──────────────────────────────────────────────────────────────┘
                              │
                        POST /events
                              │
┌──────────────────────────────────────────────────────────────┐
│                  Ingest Service (HTTP)                        │
│ • Event validation & routing                                 │
│ • Publishes to message bus                                   │
└──────────────────────────────────────────────────────────────┘
                              │
                    NATS/Kafka Topics
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
  Topic: signal.raw    Topic: feedback.recorded   ...
        │                     │
        ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│ Signal Agent     │  │ Feedback Agent   │
└──────────────────┘  └──────────────────┘
        │                     │
        └─────────────────────┤
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│            Context Agent (Enrichment)                         │
│ Adds: page, device, cohort, consent state                    │
└──────────────────────────────────────────────────────────────┘
                              │
                    Enriched Events
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    Ethics Agent       Correlator Agent        Storage Agent
    (Throttle)        (Journey Stitching)      (Projections)
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   Redis Store         DuckDB/ClickHouse      Insight Agent (AI)
  (Session State)    (Analytics, Metrics)     (Clustering, LLM)
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                   Dashboard API (GraphQL/REST)
                              │
                    ┌─────────────────┐
                    │ React Dashboard │
                    │ • Hotspots      │
                    │ • Sentiment     │
                    │ • Evidence      │
                    │ • Insights      │
                    └─────────────────┘
```

## Components

### 1. Widget (Frontend)

**Responsibilities:**
- Capture passive interaction signals
- Show throttled micro-prompts
- Collect optional 1-tap reactions
- Queue events offline-first
- Batch and POST to ingest

**Tech:** Vanilla TypeScript, <15KB bundled + gzipped

**Key Classes:**
- `SignalCapture`: click, hover, scroll, dwell, hesitation, rage-click detection
- `MicroPrompt`: 1-tap reaction UI (👍 👎 😕)
- `ConsentManager`: consent banner + local storage
- `EventQueue`: offline queue, batching, retries
- `ThrottleManager`: minimum interval between prompts

**Files:**
- `widget/src/index.ts` — Main entry point, orchestrator
- `widget/src/signal-capture.ts` — Passive signal detection
- `widget/src/micro-prompt.ts` — Reaction UI
- `widget/src/consent.ts` — Consent banner + privacy
- `widget/src/queue.ts` — Event batching + retry
- `widget/src/throttle.ts` — Rate limiting

### 2. Ingest Service (HTTP Collector)

**Responsibilities:**
- Accept events from widget
- Validate event payloads
- Route to message bus topics
- Health checks, metrics

**Tech:** Express.js, NATS client

**Endpoints:**
- `POST /events` — Batch event collection
- `GET /health` — Health check

**Files:**
- `backend/src/services/ingest.ts`
- `backend/src/services/message-bus.ts`

### 3. Backend Agents (Event-Driven)

Each agent is a stateless worker consuming/producing on topics.

#### Signal Agent
- **Input:** `flowback.signal.raw`
- **Processing:** Detect rage-clicks (3+ clicks <500ms), hesitation (3+ sec dwell)
- **Output:** `flowback.signal.normalized`
- **File:** `backend/src/agents/signal-agent.ts`

#### Feedback Agent
- **Input:** `flowback.feedback.recorded`
- **Processing:** Enrich reactions with context
- **Output:** Storage, optional aggregation
- **File:** `backend/src/agents/feedback-agent.ts`

#### Context Agent
- **Input:** `flowback.signal.raw`, `flowback.feedback.recorded`
- **Processing:** Add page, device, cohort, consent
- **Output:** `flowback.context.enriched`
- **File:** `backend/src/agents/context-agent.ts`

#### Ethics/Throttling Agent
- **Input:** On-demand policy checks
- **Processing:** Enforce prompt frequency (30s min), consent state, regional rules
- **Output:** `flowback.policy.updated`
- **File:** `backend/src/agents/ethics-agent.ts`

#### Session Correlator Agent
- **Input:** `flowback.signal.normalized`
- **Processing:** Stitch into journeys, calculate friction score
- **Output:** `flowback.session.friction`
- **File:** `backend/src/agents/correlator-agent.ts`

#### Insight Agent (Optional AI)
- **Input:** `flowback.feedback.recorded`, `flowback.session.friction`
- **Processing:** Batch clustering, LLM summarization
- **Output:** `flowback.insight.summary`
- **File:** `backend/src/agents/insight-agent.ts`

### 4. Storage Layer

#### Redis
- Session state (consent, preferences)
- Throttle windows
- Live session correlation
- TTL: 1 hour default

#### DuckDB / ClickHouse
- Hotspots (pages + friction metrics)
- Sentiment timeline (reactions over time)
- Evidence (anonymized event snippets)
- Optimized for OLAP queries

**Files:**
- `backend/src/storage/redis-store.ts`
- `backend/src/storage/analytics-store.ts`

### 5. Dashboard API

GraphQL/REST endpoints serve:
- `/api/hotspots` — Friction hotspots ranked by score
- `/api/sentiment` — Daily sentiment trend
- `/api/evidence` — Anonymized event snippets
- `/api/insights` — AI-generated insights (optional)
- `/api/sessions/:sessionId` — Session state

**File:** `backend/src/services/api.ts`

### 6. Admin Dashboard (React)

**Pages:**
- **Hotspots**: Friction hotspots with metrics (rage-clicks, hesitations, backtracks)
- **Sentiment**: Stacked area chart (👍 vs 👎 vs 😕)
- **Evidence**: Drill-down to event snippets
- **Insights**: AI summaries with hypotheses (optional)

**Files:**
- `dashboard/src/App.tsx` — Main app, tab routing
- `dashboard/src/pages/Hotspots.tsx`
- `dashboard/src/pages/Sentiment.tsx`
- `dashboard/src/pages/Evidence.tsx`
- `dashboard/src/pages/Insights.tsx`

### 7. AI Components (Optional)

Python scripts for batch clustering & summarization:

- **Clustering**: Groups similar feedback, produces cluster labels
- **Summarization**: Generates human-readable insights with hypotheses
- **LLM-optional**: Fallback to rule-based clustering if no LLM available

**Files:**
- `ai/src/clustering.py`
- `ai/src/summarization.py`

## Event Types & Topics

| Topic | Event Type | Purpose |
|-------|-----------|---------|
| `flowback.signal.raw` | `signal.raw` | Raw UI interactions |
| `flowback.signal.normalized` | `signal.normalized` | Normalized patterns (rage-clicks, hesitations) |
| `flowback.feedback.recorded` | `feedback.recorded` | 1-tap reactions |
| `flowback.context.enriched` | `context.enriched` | Events + metadata |
| `flowback.policy.updated` | `policy.updated` | Throttle state |
| `flowback.session.friction` | `session.friction` | Journey-level friction |
| `flowback.insight.summary` | `insight.summary` | AI-generated insights |

## Data Flow Example

**Session Start → Click → Hover → Reaction**

1. User lands on `/checkout`
   - Widget initializes, checks consent
   - Starts signal capture

2. User clicks "Continue" button
   - `signal.raw` emitted: `{action: "click", target: "#continue-btn"}`
   - Posted to ingest service
   - Ingest publishes to NATS topic `flowback.signal.raw`

3. Signal Agent processes
   - Buffers signal per session
   - No rage-click detected yet
   - Publishes to `flowback.signal.normalized` (optional)

4. Context Agent enriches
   - Adds page: `/checkout`
   - Adds device: `mobile`
   - Publishes to `flowback.context.enriched`

5. User hovers for 5 seconds on "Pay" button
   - Hesitation detected (>3s dwell)
   - `signal.raw: {action: "hover", target: "#pay-btn", dwellMs: 5000}`

6. Signal Agent → Correlator Agent
   - Builds session journey: `/checkout` → hesitation
   - Friction score incremented
   - Publishes to `flowback.session.friction`

7. User taps 👎 reaction
   - `feedback.recorded: {reaction: "thumbs_down", page: "/checkout"}`
   - Feedback Agent processes
   - Analytics store records sentiment event

8. Insight Agent (batch job, every 2 min)
   - Clusters feedback + friction
   - LLM summarizes: "High friction in payment step"
   - Publishes to `flowback.insight.summary`

9. Dashboard refreshes
   - Hotspots page shows `/checkout` with friction score 0.65
   - Sentiment shows 👎 spike at 14:32
   - Evidence drawer displays anonymized session
   - Insights card displays: "Payment feels slow on mobile"

## Scalability Considerations

- **Widget**: <15KB, works offline, batched network calls
- **Ingest**: Stateless, scales horizontally
- **Agents**: Decoupled, each can be scaled independently
- **Message Bus**: NATS (lightweight) or Kafka (enterprise)
- **Storage**: Redis for hot session state, DuckDB/ClickHouse for analytics (columnar, OLAP-optimized)
- **Dashboard**: Client-side rendering, API caching

## Extension Points

1. **Event Mesh**: Replace NATS with Kafka, RabbitMQ, or Solace Agent Mesh
2. **Human Signals**: Add wearable inputs (stress, focus) as `signal.raw` subtypes
3. **Voice**: Add "record note" → speech-to-text → insight clustering
4. **Webhooks**: Emit events to external systems (Slack, Datadog, etc.)
5. **Custom Agents**: Plug in additional analysis agents

