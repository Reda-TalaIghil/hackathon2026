# Copy-Paste Commands - Flowback Hackathon 2026

Use these exact commands in PowerShell. Open multiple terminal windows (PowerShell tabs).

## Terminal 1: Start Docker Containers

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026
docker-compose up -d nats redis postgres rabbitmq
```

Wait 10 seconds for containers to be ready, then verify:
```powershell
docker-compose ps
```

You should see all four containers running.

## Terminal 2: Start Node.js Ingest Service

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026\backend
npm run dev:ingest
```

You should see:
```
✓ Connected to NATS at nats://localhost:4222
✓ Ingest service listening on port 3001
  POST http://localhost:3001/events
```

## Terminal 3: Start Node.js API

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026\backend
npm run dev:api
```

You should see the API server starting on port 3000.

## Terminal 4: Start Dashboard Frontend

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026\dashboard
npm run dev
```

You should see:
```
  VITE v... ready in ... ms

  ➜  Local:   http://localhost:5175/
```

Open http://localhost:5175 in your browser.

## Terminal 5: Start Widget Dev Server

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026\widget
npm run dev
```

You should see:
```
  VITE v... ready in ... ms

  ➜  Local:   http://localhost:5173/
```

Open http://localhost:5173 in your browser.

## Now Test the System

1. In the widget page (http://localhost:5173):
   - Click the "Rapid Click Test" button **15+ times** (test rage-click detection)
   - Hover over "Hesitation Zone" for 3+ seconds (test hesitation detection)
   - Fill out the feedback form and submit (test sentiment capture)

2. In the ingest terminal (Terminal 2), you should see:
   ```
   📥 Received 10 events
   ✓ Published: flowback.signal.raw (session: session_xxx)
   ```

3. In the dashboard (http://localhost:5175):
   - Go to "Hotspots" tab
   - Should see friction data appearing
   - Go to "Evidence" tab
   - Should see click events listed

## Optional: Add LLM-Powered Analysis with SAM Agents

### Step 1: Get Free API Key

Choose one:
- **Cerebras** (recommended): https://cloud.cerebras.ai (1M tokens/day free)
- **Anthropic**: https://console.anthropic.com (free trial)

Copy your API key.

### Step 2: Create SAM Environment File

In PowerShell:
```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026\sam-agents
@"
LLM_SERVICE_API_KEY=your-api-key-here
LLM_SERVICE_ENDPOINT=https://api.cerebras.ai/v1
LLM_SERVICE_PLANNING_MODEL_NAME=openai/zai-glm-4.7
LLM_SERVICE_GENERAL_MODEL_NAME=openai/zai-glm-4.7
SOLACE_DEV_MODE=true
NATS_URL=nats://flowback-nats:4222
ANALYTICS_STORE_URL=http://localhost:3000
"@ | Set-Content .env
```

Replace `your-api-key-here` with your actual API key.

### Step 3: Build SAM Container

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026
docker-compose build sam-agents
```

This takes 3-5 minutes (downloads Python dependencies).

### Step 4: Start SAM in Terminal 6

```powershell
docker-compose up -d sam-agents
docker-compose logs -f sam-agents
```

You should see:
```
🚀 Starting Flowback SAM Agents...
🌉 Starting Analysis Results Bridge...
🌉 Starting NATS Event Bridge...
✓ Friction Analyzer Agent started
```

### Step 5: Test SAM Analysis

1. Click buttons on widget again (http://localhost:5173)
2. Watch SAM logs in Terminal 6 for analysis messages
3. Dashboard should show LLM-powered insights

## Useful Commands

### Stop Everything
```powershell
# Stop all services gracefully
docker-compose down
```

### View Docker Logs
```powershell
# View specific service
docker-compose logs -f ingest
docker-compose logs -f sam-agents
docker-compose logs -f nats

# View last 50 lines
docker-compose logs --tail=50 sam-agents
```

### Check Port Usage
```powershell
# See what's listening on port 5173
netstat -ano | findstr :5173
```

### Restart a Service
```powershell
# Restart just SAM agents (without stopping others)
docker-compose restart sam-agents
```

### Clean Up Docker
```powershell
# Remove unused containers/images/volumes
docker system prune -a --volumes

# Or be more selective
docker-compose down -v  # Only removes project containers/volumes
```

## Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR BROWSER                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Widget (5173)           Dashboard (5175)                   │
│  • Click detection       • Hotspots view                    │
│  • Hover tracking        • Sentiment view                   │
│  • Form tracking         • Evidence view                    │
│                                                               │
└────────┬──────────────────────────┬──────────────────────────┘
         │ POST /events             │ GET /api/hotspots
         │                          │
┌────────▼──────────┐       ┌───────▼─────────┐
│ Ingest Service    │       │ API Server      │
│ (port 3001)       │       │ (port 3000)     │
│                   │       │                 │
│ • Validate        │       │ • Return data   │
│ • Store           │       │ • JSON format   │
│ • Publish NATS    │       │                 │
└────────┬──────────┘       └─────────────────┘
         │                         ▲
         │ NATS publish            │
         │                    Analytics Store
         │                   (In-Memory Map)
         ▼
    ┌─────────┐
    │  NATS   │
    │(4222)   │
    └────┬────┘
         │
    ┌────┴─────────────────┐
    │                      │
    │ (Direct storage      │ (SAM analysis - optional)
    │  goes to store)      │
    │                      ▼
    │              ┌──────────────────┐
    │              │ RabbitMQ         │
    │              │ (5672)           │
    │              └────────┬─────────┘
    │                       │
    │                       ▼
    │              ┌──────────────────┐
    │              │ SAM Agents       │
    │              │ (port 8001)      │
    │              │                  │
    │              │ • Friction       │
    │              │   Analyzer       │
    │              │ • LLM analysis   │
    │              └────────┬─────────┘
    │                       │
    │              ┌────────▼──────────┐
    │              │ Results Bridge    │
    │              │ HTTP POST         │
    │              └────────┬──────────┘
    │                       │
    └───────────┬───────────┘
                │
                ▼
         Analytics Store
            Dashboard
```

## Files You Need to Know

| File | Purpose | When to Edit |
|------|---------|--------------|
| `backend/src/services/ingest.ts` | Event receiver | To modify event handling |
| `dashboard/src/App.tsx` | Dashboard layout | To add new visualizations |
| `widget/index.html` | Demo page | To change test scenarios |
| `sam-agents/configs/agents/friction-analyzer.yaml` | SAM agent behavior | To customize analysis |
| `.env` files | Configuration | For API keys and endpoints |

## Expected Output

When everything is running correctly:

**Ingest Logs:**
```
📥 Received 10 events
✓ Published: flowback.signal.raw (session: session_abc123)
```

**Dashboard:**
```
Hotspots: 1-2 items appearing
Sentiment: Positive/Neutral trend line
Evidence: 10+ interaction records
```

**SAM Logs (if running):**
```
✓ Friction Analyzer Agent started
[NATS Bridge] Buffered signal event: click on /demo
[SAM] Analyzing session with 5 events
✓ Published analysis for session ab...
```

## Keyboard Shortcuts

- **Ctrl+C** in terminal - Stop current service
- **Ctrl+Shift+~** in VS Code - Open terminal
- **F5** in browser - Refresh dashboard
- **F12** in browser - Developer tools (check console for errors)

## Next Steps After Testing

1. ✅ Basic flow working (widget → ingest → dashboard)
2. ✅ Try with SAM (widget → SAM agents → dashboard)
3. 📝 Document your experience
4. 🚀 Deploy to production (see docs/)
5. 🔧 Customize for your use case

## Problems?

1. **Port in use** - Change port in `vite.config.ts` or kill process
2. **npm not found** - Use full path or ensure Node.js is in PATH
3. **Docker not running** - Start Docker Desktop
4. **NATS connection failed** - Wait 5 seconds for NATS to start
5. **SAM not starting** - Check .env file for valid API key

## Questions?

See these files for more info:
- `README_SETUP.md` - Complete setup guide
- `SAM_INTEGRATION_GUIDE.md` - SAM architecture & development
- `QUICKSTART_WINDOWS.md` - Windows-specific help
- `docs/ARCHITECTURE.md` - System design
