import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import { NatsMessageBus } from './message-bus.js';
import { FlowbackEvent } from '../types.js';
import { mongoStore } from '../storage/mongo-store.js';

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
let busConnected = false;
let serviceReady = false;

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: serviceReady ? (busConnected ? 'ready' : 'degraded') : 'initializing' });
});

// Events collector endpoint
app.post('/events', async (req: Request, res: Response) => {
  console.log(`📥 Received ${Array.isArray(req.body) ? req.body.length : 0} events`);
  
  // Accept events even if bus is down; they'll still be recorded in analytics store
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

      // Route to appropriate topic based on event type (if bus is available)
      if (busConnected) {
        const topic = `flowback.${event.type}`;
        await messageBus.publish(topic, event);
        console.log(`✓ Published: ${topic} (session: ${(event as any).sessionId?.slice(0, 8)})`);
      }
      
      // TEMPORARY: Write directly to analytics store for demo
      // (bypassing agents since they're not connecting in separate processes)
      if (event.type === 'signal.raw') {
        const signalEvent = event as any;
        const action = signalEvent.payload?.action;
        const page = signalEvent.payload?.details?.target || '/demo';
        
        console.log(`[Ingest] Processing signal: ${action} on ${page}`);
        
        // Record all signal types as hotspots
        if (action === 'click') {
          const isRageClick = signalEvent.payload?.details?.rageClick;
          console.log(`[Ingest] Recording click (rage=${isRageClick}) to MongoDB`);
          await mongoStore.recordHotspot(
            event.projectId,
            page,
            { 
              clickCount: 1, 
              rageClicks: isRageClick ? 1 : 0, 
              hesitations: 0, 
              avgDuration: 200 
            },
            0 // Friction score recalculated by store
          );
          if (isRageClick) {
            await mongoStore.recordEvidence(
              event.projectId,
              signalEvent.sessionId,
              'rage-click',
              `Rapid click detected (${signalEvent.payload?.details?.count || 3} clicks in ${signalEvent.payload?.details?.spanMs || 500}ms)`
            );
          }
        } else if (action === 'hover') {
          const dwellMs = signalEvent.payload?.details?.dwellMs || 0;
          const hesitation = dwellMs > 3000 ? 1 : 0;
          console.log(`[Ingest] Recording hover (hesitation=${hesitation}, dwell=${dwellMs}ms) to MongoDB`);
          await mongoStore.recordHotspot(
            event.projectId,
            page,
            { clickCount: 0, rageClicks: 0, hesitations: hesitation, avgDuration: dwellMs },
            0 // Friction score recalculated by store
          );
          if (hesitation > 0) {
            await mongoStore.recordEvidence(
              event.projectId,
              signalEvent.sessionId,
              'hesitation',
              `User hesitated for ${dwellMs}ms on ${signalEvent.payload?.details?.target}`
            );
          }
        } else if (action === 'idle') {
          console.log(`[Ingest] Recording idle to MongoDB`);
          await mongoStore.recordHotspot(
            event.projectId,
            page,
            { clickCount: 0, rageClicks: 0, hesitations: 1, avgDuration: signalEvent.payload?.details?.idleMs || 3000 },
            0 // Friction score recalculated by store
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
  const PORT = parseInt(process.env.INGEST_PORT || '3001');

  // Connect to MongoDB first
  try {
    await mongoStore.connect();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }

  // Attempt to connect to message bus, but don't block service if it fails
  try {
    await messageBus.connect();
    busConnected = true;
    console.log('✓ Connected to NATS message bus');
  } catch (error) {
    busConnected = false;
    console.warn('⚠️ NATS bus unavailable; running in local-only mode:', error);
  }

  try {
    app.listen(PORT, () => {
      serviceReady = true;
      console.log(`\n✓ Ingest service listening on port ${PORT}`);
      console.log(`  POST http://localhost:${PORT}/events`);
    });
  } catch (error) {
    console.error('Failed to start ingest service:', error);
    process.exit(1);
  }
}

start();
