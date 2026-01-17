# Solace Agent Mesh - Flowback Analytics

Advanced LLM-powered agents for analyzing user interaction patterns and friction in the Flowback product feedback system.

## Services

- **Friction Analyzer Agent**: Analyzes user interactions to identify UX friction points
- **NATS Event Bridge**: Connects Node.js ingest service to SAM agents
- **Orchestrator**: Routes analysis requests to specialized agents

## Quick Start

### 1. Set up Environment

```bash
cp .env.example .env
# Edit .env with your Cerebras API key:
# LLM_SERVICE_API_KEY=your-key-here
```

### 2. Install Dependencies

Requires Python 3.11+. Using `uv` (recommended):

```bash
uv sync
```

Or with pip:

```bash
pip install -e .
```

### 3. Run SAM Agents

```bash
uv run sam run configs/
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
