# Flowback: Invisible, In-Moment Feedback

## Overview

Flowback eliminates traditional surveys by capturing natural, invisible feedback during normal digital interactions. Users never "take a survey"—feedback emerges from behavior, micro-interactions, and optional 1-tap reactions.

### Core Principles

- **Non-intrusive**: Passive signal capture + rare 1-tap prompts
- **Consent-aware**: Explicit consent, privacy-first, throttled
- **Event-driven**: Decoupled agents communicate via message bus
- **AI-optional**: Works fully without AI; AI only for clustering/summarization
- **Human-controlled**: No AI triggers prompts or makes decisions

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (for NATS, Redis, DuckDB)

### 1. Clone & Install

```bash
npm install
```

### 2. Start Services

```bash
docker-compose up -d
```

### 3. Dev Environment

```bash
npm run dev
```

This starts:
- **Widget dev server**: http://localhost:5173
- **Backend services**: http://localhost:3001 (ingest)
- **Dashboard**: http://localhost:5174

### 4. Embed Widget in Test Page

```html
<script>
  window.flowbackConfig = {
    projectId: 'test-project-123',
    apiUrl: 'http://localhost:3001',
    consent: true
  };
</script>
<script src="http://localhost:5173/flowback.js"></script>
```

## Project Structure

```
flowback/
├── widget/                 # Embeddable JS SDK
│   ├── src/
│   │   ├── index.ts       # Main entry point
│   │   ├── signal-capture.ts
│   │   ├── micro-prompt.ts
│   │   ├── consent.ts
│   │   ├── queue.ts
│   │   └── types.ts
│   └── package.json
│
├── backend/               # Event-driven services
│   ├── services/
│   │   ├── ingest.ts      # HTTP collector + message bus router
│   │   └── api.ts         # Dashboard API (GraphQL/REST)
│   │
│   ├── agents/            # Stateless event consumers
│   │   ├── signal-agent.ts
│   │   ├── feedback-agent.ts
│   │   ├── context-agent.ts
│   │   ├── ethics-agent.ts
│   │   ├── correlator-agent.ts
│   │   └── insight-agent.ts (optional AI)
│   │
│   ├── storage/           # Data layer
│   │   ├── redis-store.ts
│   │   ├── duckdb-store.ts
│   │   └── projections.ts
│   │
│   └── package.json
│
├── dashboard/             # Admin UI (React/Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Hotspots.tsx
│   │   │   ├── Sentiment.tsx
│   │   │   ├── Evidence.tsx
│   │   │   └── Insights.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── App.tsx
│   └── package.json
│
├── ai/                    # Optional AI components
│   ├── clustering.py      # Batch clustering job
│   ├── summarization.py   # Insight generation
│   └── requirements.txt
│
├── docs/                  # Documentation & examples
│   ├── ARCHITECTURE.md
│   ├── EVENT_SCHEMA.md
│   ├── INTEGRATION.md
│   └── API.md
│
└── docker-compose.yml     # Local dev environment

```

## Event-Driven Architecture

Agents communicate via a message bus (NATS/Kafka). Each agent is a stateless, topic-bound consumer:

### Event Types

| Event | Source | Purpose |
|-------|--------|---------|
| `signal.raw` | Widget | Raw UI interactions (click, hover, scroll, dwell) |
| `signal.normalized` | Signal Agent | Normalized, deduplicated signals (rage-clicks, hesitation) |
| `feedback.recorded` | Feedback Agent | 1-tap reactions with context |
| `context.enriched` | Context Agent | Signals + metadata (page, device, cohort, consent) |
| `policy.updated` | Ethics Agent | Throttle state & permission to prompt |
| `session.friction` | Correlator Agent | Journey-level friction segments |
| `insight.summary` | Insight Agent (AI) | Clustered insights with hypotheses |

## Key Features

### 1. Widget (JS SDK)
- **Passive capture**: Clicks, hovers, scroll depth, dwell time, hesitation, backtracks, rage-clicks
- **Micro-prompts**: 1-tap reactions (👍 👎 😕), contextual, throttled
- **Consent-first**: Explicit toggle, local cooldown storage
- **Resilient**: Offline queue, batched POST with backpressure

### 2. Backend Agents
- **Signal Agent**: Normalizes raw signals, detects rage-clicks & hesitation
- **Feedback Agent**: Ties 1-tap reactions to session/page context
- **Context Agent**: Enriches all events with device, page, cohort, consent state
- **Ethics/Throttling Agent**: Enforces frequency caps, regional consent, suppression windows
- **Correlator Agent**: Stitches sequences into journeys, marks friction hotspots
- **Insight Agent** (optional AI): Clusters + summarizes patterns, generates hypotheses

### 3. Admin Dashboard
- **Hotspots map**: Journeys ranked by friction; drill-down to raw signals
- **Sentiment trends**: Stacked area chart (👍 vs 👎 vs 😕) over time
- **Evidence drawer**: Anonymized event snippets tied to friction
- **Insight cards**: AI-generated or rule-based summaries with drill-down
- **Controls**: Segment by page/device/cohort, export, alerts

### 4. Data Stores
- **Redis**: Session state, throttle windows, consent flags
- **DuckDB** (or ClickHouse): OLAP analytics for hot paths, sentiment timelines, friction metrics
- **Object storage** (S3/local): Raw session envelopes for deep investigation

## SurveyMonkey Alignment

| Challenge | Flowback Solution |
|-----------|-------------------|
| Static surveys are tedious | Zero forms; feedback via behavior + 1-tap |
| Low response rates | 1-tap, contextual, throttled; no time tax |
| Delayed insights | Real-time streams; continuous sentiment pulse |
| Friction invisible | Passive hesitation/backtrack detection + visual hotspots |
| Privacy concerns | Consent-first, anonymized sessions, data retention limits |

## What's Built in 48 Hours

### ✅ Complete
- Widget: signal capture, micro-prompt UI, consent, throttling
- Ingest service: HTTP collector, message bus router
- Signal Agent, Feedback Agent, Context Agent, Ethics Agent
- Redis + DuckDB setup with basic projections
- Dashboard hotspots page with chart & drill-down
- Docker Compose for local dev

### 🔄 Partial
- Correlator Agent: basic session stitching
- Dashboard sentiment page: chart only (no drill-down yet)
- AI: clustering job script (requires manual trigger)

### 📋 Future
- Session Correlator polish (advanced journey analysis)
- Full dashboard (evidence, insights, alerts)
- AI auto-trigger for weekly digests
- Event mesh integration (Solace)
- Voice summaries, wearable signal inputs

## Extensibility

### Event Mesh Integration
The message bus is abstracted; swap NATS for Kafka or Solace Agent Mesh without changing agent code:

```typescript
// agents/base-agent.ts
export interface MessageBus {
  subscribe(topic: string, handler: (msg: any) => Promise<void>): void;
  publish(topic: string, msg: any): Promise<void>;
}
```

### Human Signal Inputs
Add wearable/focus signals as new `signal.raw` subtypes:

```json
{
  "sessionId": "...",
  "type": "wearable",
  "subtype": "stress",
  "value": 0.75,
  "device": "apple-watch"
}
```

### Voice Summaries
Extend dashboard with "record 30s note" → speech-to-text → insight clustering.

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start services (Docker required)
docker-compose up -d

# 3. Dev mode (all services)
npm run dev

# 4. Or run individually
npm run dev --workspace=widget
npm run dev --workspace=backend
npm run dev --workspace=dashboard

# 5. Test widget on localhost:5173
open http://localhost:5173
```

## API Quick Reference

### Ingest Endpoint
```bash
POST http://localhost:3001/events
Content-Type: application/json

[
  {
    "sessionId": "sess_123",
    "projectId": "proj_456",
    "timestamp": 1705424400000,
    "type": "signal.raw",
    "payload": {
      "action": "click",
      "target": "#checkout-btn",
      "dwellMs": 3200
    }
  }
]
```

### Dashboard API
```bash
GET http://localhost:3000/api/hotspots?page=/checkout
GET http://localhost:3000/api/sentiment?from=2026-01-01&to=2026-01-16
GET http://localhost:3000/api/evidence?clusterId=pay-latency
```

## Development

- **Languages**: TypeScript (backend/widget), React+TypeScript (dashboard), Python (AI)
- **Message Bus**: NATS (dev); Kafka-compatible for prod
- **DB**: DuckDB (analytics), Redis (cache), optionally ClickHouse
- **AI**: LLM-agnostic; examples use OpenAI

## Contributing

1. Create a feature branch
2. Implement agent/service following event-driven patterns
3. Add tests
4. Submit PR

## License

Proprietary (Hackathon Project)

---

**Built for SurveyMonkey's "Future of Feedback" Challenge — Hackathon 2026**
