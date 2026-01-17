# Flowback Hackathon 2026 - Quick Start Guide

## Architecture Overview

```
┌─────────────────┐
│  Web Widget     │ (Port 5173)
└────────┬────────┘
         │ POST /events
         ▼
┌─────────────────┐
│  Node.js Ingest │ (Port 3001)
│   Service       │
└────────┬────────┘
         │ NATS publish
         ▼
    ┌────────┐
    │  NATS  │ (Port 4222)
    └────┬───┘
         │
      ┌──┴───────────────┐
      │                  │
      ▼                  ▼
┌────────────┐    ┌─────────────┐
│ RabbitMQ   │    │  Node.js    │
│ (SAM)      │    │  Analytics  │
│ (5672)     │    │  Store      │
└────┬───────┘    └─────────────┘
     │                   ▲
     ▼                   │
┌─────────────┐         │
│  SAM Agents │─────────┘
│  (8001)     │
└─────────────┘
     │
     ▼
┌──────────────┐
│  Dashboard   │ (Port 5175)
└──────────────┘
```

## Quick Start (Windows)

### 1. Start Docker Containers

```bash
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026
docker-compose up -d nats redis postgres rabbitmq
```

Verify all are running:
```bash
docker-compose ps
```

You should see:
- `flowback-nats`
- `flowback-redis`
- `flowback-postgres`
- `flowback-rabbitmq`

### 2. Start Node.js Backend

Open a terminal and run:

```bash
cd backend
npm install  # Only needed first time
npm run dev:ingest  # Port 3001
```

In another terminal:

```bash
cd backend
npm run dev:api  # Port 3000
```

### 3. Start Dashboard Frontend

```bash
cd dashboard
npm run dev  # Port 5175
```

### 4. Start Widget Dev Server

```bash
cd widget
npm run dev  # Port 5173
```

### 5. Start SAM Agents (Optional - requires LLM API key)

For advanced LLM-powered analysis:

1. Get a free API key from [Cerebras](https://cloud.cerebras.ai) or [Anthropic](https://console.anthropic.com/)

2. Create `sam-agents/.env`:
   ```bash
   LLM_SERVICE_API_KEY=your-api-key-here
   ```

3. Build and start:
   ```bash
   docker-compose build sam-agents
   docker-compose up -d sam-agents
   ```

   Check logs:
   ```bash
   docker-compose logs -f sam-agents
   ```

## Access Points

- **Widget Demo**: http://localhost:5173
- **Dashboard**: http://localhost:5175
- **Backend Ingest**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **SAM Web UI**: http://localhost:8001 (if SAM is running)
- **RabbitMQ Admin**: http://localhost:15672 (guest/guest)

## How It Works

1. **Widget captures events** - User clicks, hovers, form fills sent to ingest service
2. **Ingest stores events** - Events stored in in-memory analytics store via NATS
3. **Dashboard displays data** - Shows friction hotspots, sentiment trends, user evidence
4. **SAM analyzes (optional)** - LLM-powered agents analyze patterns for deeper insights

## Testing the Flow

1. Open http://localhost:5173 in your browser
2. Click the "Rapid Click Test" button 10+ times
3. Hover over "Hesitation Zone" for 3+ seconds
4. Fill out the feedback form
5. Open http://localhost:5175
6. You should see hotspots and sentiment data appearing

## Environment Variables

See `.env.example` files in each service directory:
- `backend/.env`
- `dashboard/.env`
- `sam-agents/.env`

## Troubleshooting

### Events not appearing in dashboard
1. Check ingest logs: See terminal where `npm run dev:ingest` is running
2. Verify widget config: Check console in browser developer tools
3. Check API: `curl http://localhost:3000/api/hotspots?projectId=demo-project`

### SAM agents not connecting
1. Check RabbitMQ is running: `docker-compose ps | grep rabbitmq`
2. Check logs: `docker-compose logs sam-agents`
3. Verify .env has valid LLM_SERVICE_API_KEY

### Docker containers not starting
1. Ensure Docker Desktop is running
2. Check port availability: `netstat -ano | findstr :4222` (for NATS)
3. Clean up: `docker-compose down && docker-compose up -d`

## Project Structure

```
hackathon2026/
├── backend/              # Node.js ingest + API
│   ├── src/agents/       # TypeScript agents (signal, correlator, etc)
│   ├── src/services/     # Ingest, API, message bus
│   ├── src/storage/      # Analytics store (in-memory)
│   └── package.json
├── dashboard/            # React frontend
│   └── src/pages/        # Hotspots, Evidence, Sentiment, Insights
├── widget/               # Embedding widget + demo
│   ├── src/              # Signal capture, consent, queue
│   └── index.html        # Demo page
├── sam-agents/           # Python Solace Agent Mesh (LLM agents)
│   ├── configs/agents/   # Friction analyzer, sentiment analyzer
│   ├── src/              # NATS bridges, custom tools
│   └── pyproject.toml
└── docker-compose.yml    # Container orchestration
```

## Documentation

- [Architecture Details](docs/ARCHITECTURE.md)
- [Event Schema](docs/EVENT_SCHEMA.md)
- [Integration Guide](docs/INTEGRATION.md)
- [SAM Agent Development](sam-agents/README.md)
