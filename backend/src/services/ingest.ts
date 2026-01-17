import express, { Request, Response } from 'express';
import { NatsMessageBus } from './message-bus.js';
import { FlowbackEvent } from '../types.js';
import { analyticsStore } from '../storage/analytics-store.js';

/**
 * Ingest Service
 * Lightweight HTTP endpoint that receives events and routes to message bus
 */

const app = express();
app.use(express.json({ limit: '10mb' }));

// Enable CORS for all origins (for development)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

const messageBus = new NatsMessageBus(process.env.NATS_URL);
let isConnected = false;

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: isConnected ? 'ready' : 'initializing' });
});

// Events collector endpoint
app.post('/events', async (req: Request, res: Response) => {
  console.log(`📥 Received ${Array.isArray(req.body) ? req.body.length : 0} events`);
  
  if (!isConnected) {
    res.status(503).json({ error: 'Service not ready' });
    return;
  }

  const events: FlowbackEvent[] = req.body;

  if (!Array.isArray(events)) {
    res.status(400).json({ error: 'Expected array of events' });
    return;
  }

  try {
    // Validate and route each event
    for (const event of events) {
      if (!event.type || !event.projectId || !(event as any).sessionId) {
        console.warn('Invalid event, skipping:', event);
        continue;
      }

      // Route to appropriate topic based on event type
      const topic = `flowback.${event.type}`;
      await messageBus.publish(topic, event);

      console.log(`✓ Published: ${topic} (session: ${(event as any).sessionId?.slice(0, 8)})`);
      
      // TEMPORARY: Write directly to analytics store for demo
      // (bypassing agents since they're not connecting in separate processes)
      if (event.type === 'signal.raw') {
        const signalEvent = event as any;
        const action = signalEvent.payload?.action;
        const page = signalEvent.payload?.details?.target || '/demo';
        
        // Record all signal types as hotspots
        if (action === 'click') {
          const isRageClick = signalEvent.payload?.details?.rageClick;
          await analyticsStore.recordHotspot(
            event.projectId,
            page,
            { 
              clickCount: 1, 
              rageClicks: isRageClick ? 1 : 0, 
              hesitations: 0, 
              avgDuration: 200 
            },
            isRageClick ? 0.8 : 0.4 // Higher score for rage clicks
          );
          if (isRageClick) {
            await analyticsStore.recordEvidence(
              event.projectId,
              signalEvent.sessionId,
              'rage-click',
              `Rapid click detected (${signalEvent.payload?.details?.count || 3} clicks in ${signalEvent.payload?.details?.spanMs || 500}ms)`
            );
          }
        } else if (action === 'hover') {
          const dwellMs = signalEvent.payload?.details?.dwellMs || 0;
          const hesitation = dwellMs > 3000 ? 1 : 0;
          await analyticsStore.recordHotspot(
            event.projectId,
            page,
            { clickCount: 0, rageClicks: 0, hesitations: hesitation, avgDuration: dwellMs },
            hesitation > 0 ? 0.5 : 0.1
          );
          if (hesitation > 0) {
            await analyticsStore.recordEvidence(
              event.projectId,
              signalEvent.sessionId,
              'hesitation',
              `User hesitated for ${dwellMs}ms on ${signalEvent.payload?.details?.target}`
            );
          }
        } else if (action === 'idle') {
          await analyticsStore.recordHotspot(
            event.projectId,
            page,
            { clickCount: 0, rageClicks: 0, hesitations: 1, avgDuration: signalEvent.payload?.details?.idleMs || 3000 },
            0.3
          );
        }
      }
    }

    res.json({ received: events.length, queued: events.length });
  } catch (error) {
    console.error('Error processing events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
async function start() {
  try {
    await messageBus.connect();
    isConnected = true;

    const PORT = parseInt(process.env.INGEST_PORT || '3001');
    app.listen(PORT, () => {
      console.log(`\n✓ Ingest service listening on port ${PORT}`);
      console.log(`  POST http://localhost:${PORT}/events`);
    });
  } catch (error) {
    console.error('Failed to start ingest service:', error);
    process.exit(1);
  }
}

start();
