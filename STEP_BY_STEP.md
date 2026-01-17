# Step-by-Step Setup Commands

Follow these commands in order. Copy and paste exactly as shown.

## ⏱️ Total Time: 5-10 minutes (first run)

---

## STEP 1: Verify Docker is Running

```powershell
docker ps
```

**Expected output:** List of containers (even if empty)

**If error:** Start Docker Desktop first, wait 30 seconds, try again.

---

## STEP 2: Navigate to Project

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026
```

**Verify:** You should see `docker-compose.yml` in the directory

```powershell
ls docker-compose.yml
```

---

## STEP 3: Start Docker Containers

**Open PowerShell Terminal 1** and run:

```powershell
docker-compose up -d nats redis postgres rabbitmq
```

**Wait 10 seconds**, then verify:

```powershell
docker-compose ps
```

**Expected:** You should see 4 containers running:
- flowback-nats ✓
- flowback-redis ✓
- flowback-postgres ✓
- flowback-rabbitmq ✓

---

## STEP 4: Start Backend Ingest Service

**Open PowerShell Terminal 2** and run:

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026\backend
npm run dev:ingest
```

**Expected output:**
```
✓ Connected to NATS at nats://localhost:4222
✓ Ingest service listening on port 3001
  POST http://localhost:3001/events
```

**Keep this terminal open** ⬅️

---

## STEP 5: Start Backend API Server

**Open PowerShell Terminal 3** and run:

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026\backend
npm run dev:api
```

**Expected output:** Server starting on port 3000

**Keep this terminal open** ⬅️

---

## STEP 6: Start Dashboard Frontend

**Open PowerShell Terminal 4** and run:

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026\dashboard
npm run dev
```

**Expected output:**
```
  VITE v... ready in ... ms
  ➜  Local:   http://localhost:5175/
```

**Keep this terminal open** ⬅️

---

## STEP 7: Start Widget Dev Server

**Open PowerShell Terminal 5** and run:

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026\widget
npm run dev
```

**Expected output:**
```
  VITE v... ready in ... ms
  ➜  Local:   http://localhost:5173/
```

**Keep this terminal open** ⬅️

---

## STEP 8: Test Basic System

**Open your browser** and go to:

```
http://localhost:5173
```

**Click the "Rapid Click Test" button 15+ times**

Check **Terminal 2** (ingest logs) - you should see:
```
📥 Received 10 events
✓ Published: flowback.signal.raw (session: session_...)
```

✅ **Basic system is working!**

---

## STEP 9: View Dashboard with Data

**Open your browser** and go to:

```
http://localhost:5175
```

You should see:
- ✅ Hotspots tab with friction data
- ✅ Evidence tab with click events
- ✅ Sentiment tab with feedback

✅ **End-to-end flow complete!**

---

## OPTIONAL: Add LLM-Powered SAM Agents

Skip this section if you want basic functionality only. Otherwise, continue.

### STEP 10: Get Free LLM API Key

Choose ONE:

**Option A: Cerebras (Recommended)**
```
1. Go to: https://cloud.cerebras.ai
2. Sign up (free)
3. Create API key
4. Copy the key
```

**Option B: Anthropic**
```
1. Go to: https://console.anthropic.com
2. Sign up (free trial)
3. Create API key
4. Copy the key
```

---

### STEP 11: Create SAM Environment File

**Open PowerShell Terminal 1** (the one with docker) and run:

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026\sam-agents
```

Create the `.env` file with your API key:

```powershell
@"
LLM_SERVICE_API_KEY=PASTE_YOUR_API_KEY_HERE
LLM_SERVICE_ENDPOINT=https://api.cerebras.ai/v1
LLM_SERVICE_PLANNING_MODEL_NAME=openai/zai-glm-4.7
LLM_SERVICE_GENERAL_MODEL_NAME=openai/zai-glm-4.7
SOLACE_DEV_MODE=true
NATS_URL=nats://flowback-nats:4222
ANALYTICS_STORE_URL=http://localhost:3000
"@ | Set-Content .env
```

**Replace** `PASTE_YOUR_API_KEY_HERE` with your actual API key from Step 10.

**Verify the file was created:**

```powershell
cat .env
```

Should show your configuration.

---

### STEP 12: Build SAM Container

**In Terminal 1**, run:

```powershell
cd c:\Users\redar\OneDrive\Bureau\Projects\hackathon2026
docker-compose build sam-agents
```

**Wait 5-10 minutes** for Docker to download and build.

**Expected:** Ends with
```
Successfully built ...
Successfully tagged ...
```

---

### STEP 13: Start SAM Agents

**In Terminal 1**, run:

```powershell
docker-compose up -d sam-agents
```

**Check logs immediately:**

```powershell
docker-compose logs -f sam-agents
```

**Expected output within 30 seconds:**
```
🚀 Starting Flowback SAM Agents...
🌉 Starting Analysis Results Bridge...
🌉 Starting NATS Event Bridge...
✓ Friction Analyzer Agent started
```

**Keep watching the logs** (press Ctrl+C to exit after seeing startup messages)

---

### STEP 14: Test SAM with Widget

1. **Go to widget:** http://localhost:5173
2. **Click buttons** 10-15 times to generate events
3. **Watch SAM logs** in Terminal 1

You should see in the logs:
```
📥 Buffered signal event: click on /demo
🔍 Analyzing session session_xxx with 5 events
✓ Published analysis for session session_xxx
```

4. **Refresh dashboard:** http://localhost:5175

You should see **AI-powered insights** in the Insights tab

✅ **Full system with LLM analysis is working!**

---

## 🎉 Success Checklist

### Basic System (Required)
- [ ] Docker containers running (Step 3)
- [ ] Ingest service running (Step 4)
- [ ] API server running (Step 5)
- [ ] Dashboard running (Step 6)
- [ ] Widget running (Step 7)
- [ ] Dashboard shows data (Step 9)

### With SAM (Optional)
- [ ] API key obtained (Step 10)
- [ ] .env file created (Step 11)
- [ ] SAM container built (Step 12)
- [ ] SAM container started (Step 13)
- [ ] SAM analyzing events (Step 14)

---

## 📍 Access Points

| Service | URL | Status |
|---------|-----|--------|
| Widget | http://localhost:5173 | ✅ Open in browser |
| Dashboard | http://localhost:5175 | ✅ Open in browser |
| Ingest API | http://localhost:3001 | ℹ️ Backend only |
| API Server | http://localhost:3000 | ℹ️ Backend only |
| SAM Web UI | http://localhost:8001 | ✅ If SAM running |
| RabbitMQ Admin | http://localhost:15672 | ℹ️ guest/guest |

---

## 🆘 Quick Troubleshooting

### "Port already in use"
```powershell
# Kill process on port 5173
netstat -ano | findstr :5173
# Note the PID, then:
taskkill /PID <PID> /F
```

### "Docker command not found"
- Ensure Docker Desktop is running
- Restart PowerShell after installing Docker

### "npm: command not found"
- Ensure Node.js is installed
- Restart PowerShell after installing

### "Can't connect to NATS"
- Wait 10 seconds for NATS to fully start
- Verify: `docker-compose ps` shows flowback-nats running

### "SAM not starting"
- Check `.env` file exists: `cat sam-agents/.env`
- Verify API key is valid
- Check logs: `docker-compose logs sam-agents`

### "No data in dashboard"
1. Check ingest logs (Terminal 2) for errors
2. Verify you clicked buttons on widget (Step 8)
3. Refresh dashboard page (Ctrl+R)
4. Check API: `Invoke-WebRequest http://localhost:3000/api/hotspots?projectId=demo-project`

---

## 🛑 How to Stop Everything

**To pause and come back later:**
```powershell
# Stop Docker containers (keeps data)
docker-compose stop

# Stop Node.js services (Ctrl+C in each terminal)
# Terminal 2: Ctrl+C
# Terminal 3: Ctrl+C
# Terminal 4: Ctrl+C
# Terminal 5: Ctrl+C
```

**To completely reset:**
```powershell
# Remove all containers and volumes
docker-compose down -v

# Then start fresh from Step 3
```

---

## 💾 Save Commands for Later

Copy this file: `COMMANDS.md` in the project root

Or create a batch file:
```powershell
# Create setup.ps1
@"
docker-compose up -d nats redis postgres rabbitmq
Write-Host "Waiting for containers..."
Start-Sleep -Seconds 5
docker-compose ps
"@ | Set-Content setup.ps1

# Run it anytime:
.\setup.ps1
```

---

## 🎯 What's Actually Happening?

**Widget** captures your interactions (clicks, hovers)  
👇  
**Ingest** receives them on port 3001  
👇  
**NATS** distributes events  
👇  
**Two paths in parallel:**
- Direct → Analytics Store (fast, 10ms)
- SAM Agents → LLM Analysis (smart, 1-2 seconds)  
👇  
**Dashboard** displays results in real-time

---

## 📚 Full Documentation

After following these steps, see:
- `README_SETUP.md` - Complete setup guide
- `SAM_INTEGRATION_GUIDE.md` - SAM architecture
- `QUICKSTART_WINDOWS.md` - Windows tips
- `sam-agents/README.md` - SAM development

---

## ✨ You're Done!

The system is now running and ready for:
1. Capturing real user interactions
2. Analyzing friction patterns
3. Providing AI-powered insights

**Happy hacking!** 🚀
