# Flowback 2026 - Complete Setup & Run Guide

## Prerequisites

- ✅ Docker Desktop installed
- ✅ Node.js 18+ (for backend/dashboard/widget)
- 📝 LLM API key (optional, for SAM agents)

## One-Command Quick Start

```bash
# Terminal 1: Start all Docker containers
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026
docker-compose up -d nats redis postgres rabbitmq

# Terminal 2: Start Node.js ingest
cd backend
npm run dev:ingest

# Terminal 3: Start Node.js API
cd backend
npm run dev:api

# Terminal 4: Start Dashboard
cd dashboard
npm run dev

# Terminal 5: Start Widget
cd widget
npm run dev

# (Optional) Terminal 6: Start SAM agents
# First: set up .env file in sam-agents/ with LLM API key
# Then run: docker-compose up -d sam-agents
```

## Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Widget Demo | http://localhost:5173 | Interactive testing page |
| Dashboard | http://localhost:5175 | Data visualization & insights |
| Ingest API | http://localhost:3001 | Event receiver endpoint |
| API Server | http://localhost:3000 | Analytics data provider |
| SAM Web UI | http://localhost:8001 | SAM agent interface (if running) |
| RabbitMQ Admin | http://localhost:15672 | SAM message broker (guest/guest) |

## Testing the System

### 1. Basic Flow (No LLM Required)

```
Widget → Ingest → Analytics Store → Dashboard
```

**Steps:**
1. Open http://localhost:5173
2. Click "Rapid Click Test" button 10+ times
3. Open dashboard at http://localhost:5175
4. See hotspots appear in real-time

### 2. With SAM Agents (Requires LLM API Key)

```
Widget → Ingest → [NATS] → SAM Agents (LLM Analysis) → Dashboard
```

**Steps:**
1. Get free API key from [Cerebras](https://cloud.cerebras.ai)
2. Create `sam-agents/.env`:
   ```
   LLM_SERVICE_API_KEY=your-key-here
   LLM_SERVICE_ENDPOINT=https://api.cerebras.ai/v1
   LLM_SERVICE_PLANNING_MODEL_NAME=openai/zai-glm-4.7
   LLM_SERVICE_GENERAL_MODEL_NAME=openai/zai-glm-4.7
   SOLACE_DEV_MODE=true
   NATS_URL=nats://flowback-nats:4222
   ANALYTICS_STORE_URL=http://localhost:3000
   ```
3. Build and start: `docker-compose build sam-agents && docker-compose up -d sam-agents`
4. Monitor logs: `docker-compose logs -f sam-agents`
5. Interact with widget - SAM will analyze patterns and provide insights

## Project Structure at a Glance

```
hackathon2026/
├── backend/                    # Node.js services
│   ├── src/
│   │   ├── agents/            # Signal processing, friction detection
│   │   ├── services/          # Ingest, API, message bus
│   │   └── storage/           # In-memory analytics store
│   └── package.json
│
├── dashboard/                  # React frontend
│   ├── src/pages/
│   │   ├── Hotspots.tsx       # Friction visualization
│   │   ├── Sentiment.tsx       # User satisfaction
│   │   ├── Evidence.tsx        # Detailed interactions
│   │   └── Insights.tsx        # AI-powered analysis
│   └── package.json
│
├── widget/                     # Embedding widget
│   ├── src/
│   │   ├── signal-capture.ts   # Event detection
│   │   ├── queue.ts            # Event batching
│   │   └── consent.ts          # Privacy controls
│   ├── index.html              # Demo page
│   └── package.json
│
├── sam-agents/                 # Python Solace Agent Mesh (LLM agents)
│   ├── configs/
│   │   ├── orchestrator.yaml
│   │   ├── shared_config.yaml
│   │   └── agents/
│   │       └── friction-analyzer.yaml
│   ├── src/
│   │   ├── nats_bridge.py
│   │   └── results_bridge.py
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── README.md
│
├── docker-compose.yml          # Container orchestration
├── SAM_INTEGRATION_GUIDE.md     # Detailed SAM setup & development
├── QUICKSTART_WINDOWS.md        # Windows quick reference
└── IMPLEMENTATION_SUMMARY_SAM.md # What was added & how it works
```

## Common Tasks

### View Service Logs

```bash
# Node.js services
docker-compose logs -f flowback-nats
docker-compose logs -f flowback-rabbitmq
docker-compose logs -f flowback-postgres
docker-compose logs -f flowback-redis

# Check running containers
docker-compose ps
```

### Reset Everything

```bash
# Stop all services
docker-compose down -v

# Restart fresh
docker-compose up -d
```

### Test NATS Message Flow

```bash
# In Docker, subscribe to events
docker exec flowback-nats nats sub "flowback.signal.raw" -s nats://localhost:4222

# Then click buttons on widget - you should see events printed
```

### Monitor SAM Agent Activity

```bash
docker-compose logs -f sam-agents | grep -E "(Friction|analysis|✓|❌)"
```

## Troubleshooting

### "Widget not posting events"
1. Check browser console (F12) for errors
2. Verify ingest is running on port 3001
3. Check CORS headers: `curl -I http://localhost:3001/health`

### "No data in dashboard"
1. Check ingest is storing: `curl http://localhost:3000/api/hotspots?projectId=demo-project`
2. Check ingest logs for errors
3. Verify AnalyticsStore is receiving events

### "SAM agents not starting"
1. Check RabbitMQ is running: `docker ps | grep rabbitmq`
2. Verify LLM_SERVICE_API_KEY is set
3. Check SAM logs: `docker-compose logs sam-agents`

### "Port already in use"
```bash
# Find process using port (e.g., 5173)
netstat -ano | findstr :5173

# Kill it
taskkill /PID <PID> /F

# Or change port in package.json/vite.config.ts
```

## Performance Tips

- Keep SAM on separate terminal to monitor
- Use Chrome DevTools network tab to debug widget POST
- Check Redis for caching (currently unused, future optimization)
- Monitor memory with `docker stats`

## Next Steps After Demo

1. **Deploy to production** - See Railway deployment in docker-compose
2. **Add persistence** - Switch AnalyticsStore to Supabase
3. **More agents** - Add sentiment, pattern detection, recommendation
4. **Real-time updates** - WebSocket for live dashboard
5. **Custom analysis** - Add domain-specific tools to SAM agents

## Documentation

| Document | Purpose |
|----------|---------|
| `SAM_INTEGRATION_GUIDE.md` | Architecture, development patterns, debugging |
| `QUICKSTART_WINDOWS.md` | Windows-specific setup and commands |
| `IMPLEMENTATION_SUMMARY_SAM.md` | What was added, design decisions, checklist |
| `sam-agents/README.md` | SAM-specific development guide |
| `docs/ARCHITECTURE.md` | System architecture overview |
| `docs/EVENT_SCHEMA.md` | Event data formats |
| `docs/INTEGRATION.md` | Widget integration guide |

## Support

- SAM Docs: https://solacelabs.github.io/solace-agent-mesh/
- NATS Docs: https://docs.nats.io/
- GitHub Issues: Create detailed issue with logs
- Community: Reach out to hackathon sponsors

## Success Checklist

- [ ] Docker containers started (NATS, RabbitMQ, PostgreSQL, Redis)
- [ ] Node.js ingest running (port 3001)
- [ ] Node.js API running (port 3000)
- [ ] Dashboard running (port 5175)
- [ ] Widget running (port 5173)
- [ ] Widget events reaching ingest (check logs)
- [ ] Dashboard shows hotspots (after clicking buttons)
- [ ] (Optional) SAM agents running (port 8001)
- [ ] (Optional) SAM analyzing events (check logs)

## You're Ready! 🚀

The system is ready to:
1. Capture real user interactions
2. Identify friction points automatically
3. Provide actionable insights via AI
4. Help improve product UX at scale

Start with the widget, interact with the product, and watch the data flow through the system!
