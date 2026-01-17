# Integration Guide

## Embedding the Widget

### 1. Add Script Tag

```html
<script>
  window.flowbackConfig = {
    projectId: 'your-project-id',
    apiUrl: 'https://flowback.example.com/ingest',
    consent: true,  // or false for consent banner
    throttleMs: 30000,
    promptTheme: 'light'
  };
</script>
<script src="https://cdn.flowback.sh/flowback.js"></script>
```

### 2. Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectId` | string | **required** | Your project identifier |
| `apiUrl` | string | **required** | Ingest service endpoint |
| `consent` | boolean | false | Pre-grant consent (show banner if false) |
| `sampleRate` | number | 1.0 | Fraction of events to capture (0-1) |
| `throttleMs` | number | 30000 | Min milliseconds between prompts |
| `batchSize` | number | 50 | Events per POST |
| `batchIntervalMs` | number | 5000 | Max ms before flush |
| `promptTheme` | string | 'light' | 'light' or 'dark' |
| `disableAI` | boolean | false | Skip AI insights |

### 3. Example: SPA Integration

```javascript
// Next.js / React
useEffect(() => {
  window.flowbackConfig = {
    projectId: process.env.REACT_APP_FLOWBACK_PROJECT_ID,
    apiUrl: process.env.REACT_APP_FLOWBACK_API_URL,
    consent: true
  };

  // Load script
  const script = document.createElement('script');
  script.src = 'https://cdn.flowback.sh/flowback.js';
  document.head.appendChild(script);
}, []);
```

### 4. Admin Dashboard

Access dashboard at: `https://dashboard.flowback.example.com?projectId=your-project-id`

Navigate tabs:
- **Hotspots**: Pages with friction; click to drill down
- **Sentiment**: User reaction trends over time
- **Evidence**: Anonymized session snippets
- **Insights**: AI-generated friction hypotheses (optional)

---

## Backend Setup

### 1. Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: '3.9'
services:
  nats:
    image: nats:latest
    ports:
      - '4222:4222'

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

  duckdb:
    image: postgres:15  # Use as placeholder; actual DuckDB is file-based
    ports:
      - '5432:5432'
    environment:
      POSTGRES_DB: flowback
```

Start:
```bash
docker-compose up -d
```

### 2. Environment Variables

```bash
# .env
INGEST_PORT=3001
NATS_URL=nats://localhost:4222
REDIS_URL=redis://localhost:6379
DUCKDB_PATH=./data/analytics.db
DASHBOARD_API_PORT=3000
VITE_API_URL=http://localhost:3000
DISABLE_AI_INSIGHTS=false
OPENAI_API_KEY=sk-...  # Optional for AI
```

### 3. Starting Services

```bash
# Terminal 1: Ingest Service
npm run dev --workspace=backend

# Terminal 2: Signal Agent
npm run agent:signal --workspace=backend

# Terminal 3: Feedback Agent
npm run agent:feedback --workspace=backend

# Terminal 4: Context Agent
npm run agent:context --workspace=backend

# Terminal 5: Ethics Agent
npm run agent:ethics --workspace=backend

# Terminal 6: Correlator Agent
npm run agent:correlator --workspace=backend

# Terminal 7: Dashboard API
npm run agent:api --workspace=backend

# Terminal 8: Dashboard UI
npm run dev --workspace=dashboard

# Terminal 9: Widget Dev Server
npm run dev --workspace=widget
```

Or use concurrently (one terminal):
```bash
npm run dev  # Runs ingest, dashboard, widget
```

### 4. Production Deployment

**Backend Services (Kubernetes example):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flowback-ingest
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: ingest
        image: flowback:latest
        env:
        - name: NATS_URL
          value: nats://nats-cluster:4222
        - name: REDIS_URL
          value: redis://redis-cluster:6379
        ports:
        - containerPort: 3001
```

**Message Bus:**
- Dev: NATS (lightweight)
- Prod: Kafka or Solace Agent Mesh

**Storage:**
- Hot: Redis cluster (3+ nodes)
- Cold: ClickHouse cluster or S3 + Athena

**Dashboard API:**
- Stateless, scale with traffic
- Cache projections in Redis

**Widget:**
- Host on CDN with cache headers
- ~15KB gzipped

---

## Event Mesh Integration (Solace)

Flowback agents are message-bus agnostic. To integrate with Solace Agent Mesh:

### 1. Replace NATS with Solace Client

```typescript
// backend/src/services/message-bus.ts
import { SolaceClient } from '@solace/solace-web-messaging-sdk';

export class SolaceMessageBus implements MessageBus {
  private client: SolaceClient;

  async connect(): Promise<void> {
    this.client = new SolaceClient({
      url: process.env.SOLACE_URL,
      vpnName: process.env.SOLACE_VPN,
      userName: process.env.SOLACE_USER,
      password: process.env.SOLACE_PASSWORD
    });
    await this.client.connect();
  }

  async publish(topic: string, msg: any): Promise<void> {
    const message = this.client.createMessage();
    message.setDestination(this.client.createTopicDestination(topic));
    message.setBinaryAttachment(JSON.stringify(msg));
    this.client.send(message);
  }

  async subscribe(topic: string, handler: (msg: any) => Promise<void>) {
    const consumer = this.client.createMessageConsumer({
      topicSubscriptions: [topic]
    });
    consumer.onReceived = (message) => {
      handler(JSON.parse(message.getBinaryAttachment()));
    };
    consumer.start();
  }
}
```

### 2. Extend to Event Mesh Topology

```yaml
# solace-config.yaml
topics:
  flowback.signal.raw:
    subscribers: [signal-agent]
  flowback.signal.normalized:
    subscribers: [context-agent, correlator-agent]
  flowback.feedback.recorded:
    subscribers: [feedback-agent, context-agent]
  flowback.session.friction:
    subscribers: [correlator-agent, insight-agent]
  flowback.insight.summary:
    subscribers: [storage-agent, dashboard-api]

agents:
  signal-agent:
    image: flowback:latest
    workers: 3
  correlator-agent:
    image: flowback:latest
    workers: 2
```

---

## Adding Custom Signals (Wearables, Focus)

### 1. Extend Signal Types

```typescript
// widget/src/types.ts
export type SignalType = 
  | 'click' | 'hover' | 'scroll' | 'idle' | 'nav' | 'backtrack'
  | 'wearable';  // NEW

export interface SignalRaw {
  // ... existing
  payload: {
    action: SignalType;
    // For wearable:
    subtype?: 'stress' | 'focus' | 'hr';
    value?: number;
    device?: string;
  };
}
```

### 2. Capture Wearable Data

```typescript
// widget/src/wearable-capture.ts
import type { SignalRaw } from './types';

export class WearableCapture {
  private onSignal: (signal: SignalRaw) => void;

  constructor(onSignal: (signal: SignalRaw) => void) {
    this.onSignal = onSignal;
    this.startPolling();
  }

  private async startPolling() {
    // Example: Apple Watch via HealthKit Web API (future)
    // or Garmin API, Fitbit API, etc.
    setInterval(async () => {
      const stressLevel = await this.getStressLevel();
      if (stressLevel !== null) {
        this.onSignal({
          sessionId: '',
          projectId: '',
          timestamp: Date.now(),
          type: 'signal.raw',
          payload: {
            action: 'wearable',
            subtype: 'stress',
            value: stressLevel,
            device: 'apple-watch'
          }
        });
      }
    }, 5000);
  }

  private async getStressLevel(): Promise<number | null> {
    // Integrate with wearable API
    return null;
  }
}
```

### 3. Process in Backend

```typescript
// backend/src/agents/wearable-agent.ts
export class WearableAgent implements Agent {
  async processWearableSignal(event: SignalRaw) {
    if (event.payload.action === 'wearable') {
      const { subtype, value, device } = event.payload;
      
      // Enrich with other signals
      const contextEvent = {
        ...event,
        payload: {
          ...event.payload,
          wearableContext: { subtype, value, device },
          timestamp: event.timestamp
        }
      };

      // Could correlate with UI friction
      // E.g., high stress + rage-clicks = strong indicator
    }
  }
}
```

---

## Voice Summaries

### 1. Add "Record Note" Button to Dashboard

```typescript
// dashboard/src/components/RecordNote.tsx
export const RecordNote: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    // ... record audio
  };

  const uploadRecording = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('audio', blob);
    await fetch('/api/voice-summary', { method: 'POST', body: formData });
  };

  return (
    <button onClick={startRecording}>
      {isRecording ? '⏹️ Stop' : '🎙️ Record Note'}
    </button>
  );
};
```

### 2. Process Audio → Insight

```python
# ai/src/voice-summary.py
import openai
from pathlib import Path

def transcribe_and_summarize(audio_file: Path):
    """Transcribe audio, then cluster with text feedback"""
    
    # Transcribe using Whisper
    transcript = openai.Audio.transcribe('whisper-1', open(audio_file, 'rb'))
    
    # Add to insights clustering
    feedback_text = transcript['text']
    # ... cluster with other feedback
```

---

## Monitoring & Alerts

### Key Metrics

- **Event throughput**: events/sec (ingest service)
- **Latency**: event → dashboard (<5s p95)
- **Friction score**: avg hotspot friction over time
- **Sentiment ratio**: 👍 vs 👎 ratio
- **Agent lag**: message consumed vs. published (should be <1s)

### Example Prometheus Scrape Config

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'flowback-ingest'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'

  - job_name: 'flowback-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### Alerting Rules

```yaml
groups:
  - name: flowback
    rules:
      - alert: HighFrictionScore
        expr: avg(hotspot_friction_score) > 0.7
        for: 5m
        annotations:
          summary: "High friction detected"

      - alert: NegativeSentimentSpike
        expr: rate(sentiment_negative[5m]) > 0.6
        annotations:
          summary: "Negative sentiment spike"
```

