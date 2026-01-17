# Flowback Analytics - Solace Agent Mesh Integration

Advanced LLM-powered agents for analyzing user interaction patterns and UX friction in the Flowback Analytics platform.

This directory contains [Solace Agent Mesh](https://github.com/SolaceLabs/solace-agent-mesh) (SAM) agents that provide AI-powered insights on user experience data.

## Features

- **UX Insights Agent**: Analyzes user interactions to identify friction points and usability issues
- **Event-driven architecture**: Integrates with Flowback's NATS message bus
- **Built on SAM 1.13.3**: Uses official Solace Agent Mesh framework

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Create .env file
cp .env.example .env
# Edit .env with your Cerebras API key

# Build and run
docker build -t flowback-sam .
docker run -d --rm -p 8000:8000 --env-file .env --name flowback-sam flowback-sam

# Access Web UI
# Open http://localhost:8000 in your browser
```

### Option 2: Local CLI (Faster Development)

Requires Python 3.11+ and [uv](https://docs.astral.sh/uv/getting-started/installation/):

```bash
# Install dependencies
uv sync

# Run SAM
uv run sam run configs/

# Access Web UI at http://localhost:8000
```

The agents will start and listen for events from the Node.js ingest service via NATS.

### 4. Run NATS Event Bridge

In another terminal:

```bash
uv run python src/nats_bridge.py
```

This subscribes to NATS topics from the Node.js ingest service and buffers events for analysis.

## Architecture

```
Widget (browser)
    ↓ POST events
Node.js Ingest Service (port 3001)
    ↓ NATS publish
RabbitMQ Message Broker (SAM default)
    ↓
SAM Friction Analyzer Agent (LLM-powered)
    ↓
NATS publish (flowback.analysis.friction)
    ↓
NATS Event Bridge
    ↓ HTTP POST
Node.js Analytics Store (port 3000)
    ↓
Dashboard (port 5175)
```

## How It Works

1. **Widget captures events** - User interactions (clicks, hesitations, form fills) sent to Node.js ingest
2. **Ingest publishes to NATS** - Events available to SAM agents
3. **NATS Bridge buffers events** - Collects 5+ events per session before analysis
4. **Friction Analyzer agent analyzes** - Uses LLM to identify UX friction patterns
5. **Results published back** - Analysis results sent via NATS
6. **Stored in analytics** - Results persisted for dashboard visualization

## Development

### Adding Custom Tools to Agents

Edit `configs/agents/friction-analyzer.yaml`:

```yaml
tools:
  - tool_type: python
    component_module: "src.custom_tools"
    function_name: "my_analysis_tool"
    tool_config:
      threshold: 0.8
```

Then implement in `src/custom_tools.py`:

```python
async def my_analysis_tool(
    events: List[Dict], 
    tool_context=None,
    tool_config=None
) -> Dict[str, Any]:
    return {"result": "analysis"}
```

### Debugging

View agent logs with increased verbosity:

```bash
# In configs/agents/friction-analyzer.yaml:
log:
  stdout_log_level: DEBUG
```

Then restart SAM:

```bash
uv run sam run configs/
```

## Free LLM Options

- **Cerebras**: 1M tokens/day free - recommended for hackathons
- **Other OpenAI-compatible endpoints** supported via `LLM_SERVICE_ENDPOINT` config

See main project [LLM Setup Guide](../docs/llm-setup.md)
