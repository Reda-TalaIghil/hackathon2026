# Solace Agent Mesh Integration - Setup Complete

## What Has Been Added

Your Flowback hackathon project now includes **Solace Agent Mesh (SAM)** - a multi-agent AI framework that connects to your existing Node.js backend via NATS for advanced LLM-powered analysis.

### New Directory Structure

```
sam-agents/                       # Python-based Solace Agent Mesh service
├── Dockerfile                    # Container image (based on solace-agent-mesh:1.13.3)
├── pyproject.toml               # Python dependencies
├── .env                         # Environment config (API keys, URLs)
├── .env.example                 # Template
├── README.md                    # Development guide
│
├── configs/
│   ├── shared_config.yaml       # Shared YAML anchors (broker, models)
│   ├── orchestrator.yaml        # Agent orchestrator config
│   └── agents/
│       └── friction-analyzer.yaml   # LLM agent for friction analysis
│
└── src/
    ├── __init__.py
    ├── nats_bridge.py           # Listens to widget events from NATS
    └── results_bridge.py        # Forwards SAM analysis back to Node.js
```

## How It Works

```
Widget Events        Node.js Ingest       NATS              SAM Agents         Node.js API
     │                   │                 │                    │                   │
     ├──POST events──────►│                 │                    │                   │
     │                   ├──publish────────►│                    │                   │
     │                   │                 ├─(flowback.signal.raw)→               │
     │                   │                 │                    │                   │
     │                   │                 │         (Friction Analyzer)          │
     │                   │                 │         [LLM-powered analysis]       │
     │                   │                 │                    │                   │
     │                   │                 │         ◄──publish analysis results   │
     │                   │                 │         (flowback.analysis.friction)  │
     │                   │                 │                    │                   │
     │                   │                 │                    └──HTTP POST/analytics──►
     │                   │                 │                    │                   │
     │                   │ (Direct Storage)├─────────────────────────────────────────►│
     │                   ├─(store directly)─────────────────────────────────────────►│
     │                   │                 │                    │                   │
     │                   │                 │                    │    ◄─────────────┤
     │                   │                 │                    │    Analytics     │
     │                   │                 │                    │    Data          │
     │                   │                 │                    │                   │
     │◄──────────────────────────────────────────────────────────────────────────────┤
     │                                                           │                   │
     └──────────────────────────────────────────────────────────┴───────────────────►
                         Dashboard displays friction hotspots and insights
```

## Components

### 1. Friction Analyzer Agent (`configs/agents/friction-analyzer.yaml`)

An LLM-powered agent that analyzes user interactions to identify UX friction:

**What it detects:**
- Rage-clicking patterns (rapid repeated clicks)
- Hesitation zones (long pauses before action)
- Navigation dead-ends (repeated failed navigation)
- Form abandonment points
- Session backtracks

**How it works:**
- Subscribed to `flowback.signal.raw` NATS topic
- Buffers 5+ user events per session
- Sends batch to LLM for analysis
- Publishes results to `flowback.analysis.friction`

### 2. NATS Event Bridge (`src/nats_bridge.py`)

Bridges widget events to SAM agents:

- Subscribes to `flowback.signal.raw` (from Node.js ingest)
- Buffers events by session
- Triggers analysis when threshold reached
- Publishes friction findings back to NATS

### 3. Results Bridge (`src/results_bridge.py`)

Forwards SAM analysis results to Node.js backend:

- Subscribes to `flowback.analysis.friction` (from SAM agents)
- Converts SAM results to analytics format
- HTTP POST to Node.js API (`/api/hotspots`, `/api/sentiment`)
- Stores in AnalyticsStore for dashboard visualization

## Integration Points

**NATS Topics (Message Flow):**
```
flowback.signal.raw
  └─► SAM Agent processes
       └─► flowback.analysis.friction
           └─► Results Bridge HTTP POSTs to Node.js API
```

**Docker Network:**
All containers on same `flowback` network - can reference by container names:
- `flowback-nats` (port 4222)
- `flowback-rabbitmq` (port 5672 - SAM message broker)
- `flowback-sam-agents` (port 8001 - SAM Web UI)
- `flowback-postgres`, `flowback-redis` (existing)

## Getting Started with SAM

### Prerequisites

1. **LLM API Key** (free options):
   - [Cerebras](https://cloud.cerebras.ai) - 1M tokens/day
   - [Anthropic](https://console.anthropic.com/) - Free trial
   - Any OpenAI-compatible endpoint

2. **Docker** - Already required for NATS/RabbitMQ

### Quick Start

```bash
# 1. Create .env file in sam-agents/
cat > sam-agents/.env << EOF
LLM_SERVICE_API_KEY=your-api-key-here
LLM_SERVICE_ENDPOINT=https://api.cerebras.ai/v1
LLM_SERVICE_PLANNING_MODEL_NAME=openai/zai-glm-4.7
LLM_SERVICE_GENERAL_MODEL_NAME=openai/zai-glm-4.7
SOLACE_DEV_MODE=true
NATS_URL=nats://flowback-nats:4222
ANALYTICS_STORE_URL=http://localhost:3000
EOF

# 2. Build SAM container
docker-compose build sam-agents

# 3. Start SAM service
docker-compose up -d sam-agents

# 4. Monitor logs
docker-compose logs -f sam-agents
```

### Testing

1. Click buttons on widget (http://localhost:5173)
2. Check ingest logs show events being published
3. Check SAM logs show analysis happening
4. Open dashboard (http://localhost:5175)
5. Should see friction hotspots appearing

## Development

### Adding Custom Tools to Agents

Example: Add sentiment analysis tool

**1. Create Python tool** (`src/sentiment_tools.py`):
```python
async def analyze_sentiment(
    text: str,
    tool_context=None,
    tool_config=None
) -> Dict[str, Any]:
    # Your LLM call or custom logic
    return {
        "sentiment": "positive",
        "score": 0.85,
        "confidence": 0.92
    }
```

**2. Reference in agent** (`configs/agents/friction-analyzer.yaml`):
```yaml
tools:
  - tool_type: python
    component_module: "src.sentiment_tools"
    function_name: "analyze_sentiment"
```

### Modifying Agent Behavior

Edit `configs/agents/friction-analyzer.yaml`:

```yaml
instruction: |
  [Your custom instructions for how the agent should behave]

agent_card:
  title: "Your Agent Name"
  description: "What it does, when to use it, example queries"
```

Then restart SAM:
```bash
docker-compose restart sam-agents
```

## Debugging

### Check NATS connectivity
```bash
docker logs flowback-nats
# Look for "Listening on port 4222"
```

### Check RabbitMQ readiness
```bash
docker logs flowback-rabbitmq
# Look for "Server startup complete"
```

### View SAM agent logs
```bash
docker-compose logs -f sam-agents
# Look for "✓ Friction Analyzer Agent started"
```

### Verify message flow
```bash
# Check if events reach NATS from ingest
docker exec flowback-nats nats sub "flowback.signal.raw" -s nats://localhost:4222

# Check if analysis results are published
docker exec flowback-nats nats sub "flowback.analysis.friction" -s nats://localhost:4222
```

## Common Issues

### "Failed to connect to RabbitMQ"
- Ensure `flowback-rabbitmq` container is running
- Wait 10-15 seconds after starting (RabbitMQ takes time to boot)
- Check `docker-compose logs rabbitmq`

### "Agent didn't start"
- Check LLM_SERVICE_API_KEY is set and valid
- Verify LLM endpoint is reachable
- Check agent logs: `docker-compose logs sam-agents | grep -i error`

### "No data in dashboard"
1. Verify widget POSTs are reaching ingest: check ingest logs
2. Check NATS is forwarding: `docker logs flowback-nats`
3. Check SAM is running: `docker-compose ps`
4. Verify API response: `curl http://localhost:3000/api/hotspots?projectId=demo-project`

## Next Steps

1. **Deploy to production** - Use Railway or AWS with persistent storage (Supabase)
2. **Add more agents** - Create sentiment analyzer, pattern detector, etc.
3. **Custom tools** - Add domain-specific analysis (compliance, performance, etc.)
4. **Inter-agent communication** - Have agents collaborate on complex analysis
5. **Feedback loop** - Let dashboard users provide feedback to improve agent understanding

## Architecture References

- [Solace Agent Mesh Documentation](https://solacelabs.github.io/solace-agent-mesh/)
- [SAM Quickstart Template](https://github.com/SolaceDev/solace-agent-mesh-hackathon-quickstart)
- [NATS Documentation](https://docs.nats.io/)

## License

This integration follows the same license as the parent Flowback project.
