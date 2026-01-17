# Quick Start Guide

## 🚀 5-Minute Setup (Local)

### 1. Clone & Install

```bash
cd ~/Projects/hackathon2026
npm install
```

### 2. Environment

Set backend `.env` (sample):

```
OPENAI_API_KEY=sk-...
NATS_URL=nats://localhost:4222
INGEST_PORT=3002
DASHBOARD_API_PORT=3000
```

Optional: run Redis for persistence (otherwise falls back to in-memory):

```bash
docker run -p 6379:6379 -d redis:7
```

### 3. Start Services (dev)

Use separate terminals:

```bash
# Ingest (HTTP collector)
cd backend
npm run dev

# Dashboard API
cd backend
npm run agent:api

# Widget (Vite dev server)
cd widget
npm run dev  # Vite will pick an open port, e.g., 5175

# Dashboard UI (Vite)
cd dashboard
npm run dev  # Vite will pick an open port, e.g., 5176
```

Current defaults:
- **Ingest Service**: http://localhost:3002
- **Dashboard API**: http://localhost:3000
- **Dashboard UI**: http://localhost:5176 (auto-chosen if 5174/5175 busy)
- **Widget**: http://localhost:5175

### 4. Test Widget

Open http://localhost:5175 in a browser (or the port Vite prints).

- Click around, hover over elements
- You should see the consent banner
- After ~30s, a micro-prompt (👍 👎 😕) may appear
- Try clicking a reaction

### 5. View Dashboard

Open http://localhost:5176 (or the port Vite prints) in another tab.

- **Hotspots** tab: Should show friction as you interact with widget
- **Sentiment** tab: Your reactions will appear
- **Evidence** tab: Raw event snippets
- **Insights** tab: AI-generated summaries (if enough data)

---

## 📊 Sending Test Events

### Manually Post Events to Ingest

```bash
curl -X POST http://localhost:3002/events \
  -H "Content-Type: application/json" \
  -d '[
    {
      "sessionId": "test_sess_123",
      "projectId": "default",
      "timestamp": '$(date +%s)'000,
      "type": "signal.raw",
      "payload": {
        "action": "click",
        "target": "#pay-btn",
        "dwellMs": 2500
      }
    }
  ]'
```

---

## 🐛 Debugging

### Check Services Health

```bash
# Ingest service
curl http://localhost:3002/health

# Dashboard API
curl http://localhost:3000/health

# NATS connection
docker exec flowback-nats nats sub '>' &
```

### View Agent Logs

```bash
# Terminal shows debug output if NODE_ENV=development
NODE_ENV=development npm run agent:signal --workspace=backend
```

### Query Redis

```bash
docker exec -it flowback-redis redis-cli

# List sessions
KEYS session:*

# View a session
GET session:test_sess_123
```

### Query DuckDB

```bash
# DuckDB file-based; view hotspots
ls -lh data/analytics.db

# In Node:
import Database from 'better-sqlite3';
const db = new Database('./data/analytics.db');
console.log(db.prepare('SELECT * FROM hotspots LIMIT 5').all());
```

---

## 🚢 Production Checklist

- [ ] Set real `projectId` in widget config
- [ ] Use HTTPS for all endpoints
- [ ] Configure real database (ClickHouse/PostgreSQL)
- [ ] Set up Redis cluster (HA)
- [ ] Scale ingest service (k8s replicas: 3+)
- [ ] Run agents as separate deployments
- [ ] Set up NATS/Kafka cluster
- [ ] Enable monitoring (Prometheus + Grafana)
- [ ] Configure alerting (high friction, negative sentiment spikes)
- [ ] Set data retention policy (default: 30 days)
- [ ] Review privacy policy & consent flow
- [ ] Enable CORS for production domains
- [ ] Load test: 10k+ events/sec

---

## 📚 Next Steps

1. **Read Architecture**: [docs/ARCHITECTURE.md](ARCHITECTURE.md)
2. **Integration Guide**: [docs/INTEGRATION.md](INTEGRATION.md)
3. **Event Schema**: [docs/EVENT_SCHEMA.md](EVENT_SCHEMA.md)

---

## ❓ Common Issues

### Widget not capturing signals?
- Check browser console for errors
- Verify `window.flowbackConfig` is set before loading widget
- Check consent banner (click Accept to enable)

### Dashboard shows no data?
- Ensure ingest service is running: `curl http://localhost:3001/health`
- Send test events (see above)
- Check Redux DevTools (if integrated)

### Agents not processing events?
- Verify NATS is running: `docker ps | grep nats`
- Check agent logs for connection errors
- Verify `NATS_URL` env var is correct

### Dashboard API not responding?
- Check if Redis is running: `docker ps | grep redis`
- Verify `REDIS_URL` in .env
- Check DuckDB file permissions: `ls -l ./data/`

---

**Ready to scale?** See [INTEGRATION.md](INTEGRATION.md#production-deployment)
