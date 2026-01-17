import { NatsMessageBus } from '../services/message-bus.js';
import { SessionFriction, SignalNormalized, Agent } from '../types.js';

/**
 * Session Correlator Agent
 * Stitches sequences into journeys, marks friction hotspots
 */
export class CorrelatorAgent implements Agent {
  private messageBus: NatsMessageBus;
  private sessionJourneys: Map<
    string,
    {
      pages: string[];
      signals: SignalNormalized[];
      startTime: number;
    }
  > = new Map();

  constructor(messageBus: NatsMessageBus) {
    this.messageBus = messageBus;
  }

  async start(): Promise<void> {
    await this.messageBus.connect();
    await this.messageBus.subscribe('flowback.signal.normalized', (event) =>
      this.correlateSignal(event)
    );
    console.log('✓ Session Correlator Agent started');
  }

  async stop(): Promise<void> {
    await this.messageBus.disconnect();
  }

  private async correlateSignal(event: SignalNormalized) {
    const { sessionId } = event;

    // Initialize or get session journey
    if (!this.sessionJourneys.has(sessionId)) {
      this.sessionJourneys.set(sessionId, {
        pages: [],
        signals: [],
        startTime: Date.now(),
      });
    }

    const journey = this.sessionJourneys.get(sessionId)!;
    journey.signals.push(event);

    // Detect friction patterns
    const rageClicks = journey.signals.filter((s) => s.payload.action === 'rage_click');
    const hesitations = journey.signals.filter((s) => s.payload.action === 'hesitation');
    const backtracks = journey.signals.filter((s) => s.payload.action === 'backtrack');

    const frictionScore =
      (rageClicks.length * 0.3 + hesitations.length * 0.2 + backtracks.length * 0.2) /
      Math.max(journey.signals.length, 1);

    // Publish friction event if significant
    if (frictionScore > 0.1) {
      const friction: SessionFriction = {
        sessionId,
        projectId: 'default',
        timestamp: Date.now(),
        type: 'session.friction',
        payload: {
          path: journey.pages,
          frictionMetrics: {
            rageClicks: rageClicks.length,
            hesitations: hesitations.length,
            backtracks: backtracks.length,
            scrollAbandonment: false,
          },
          frictionScore: Math.min(frictionScore, 1),
          evidence: journey.signals.map((s) => ({
            timestamp: s.timestamp,
            action: s.payload.action,
            details: s.payload.metrics,
          })),
        },
      };

      await this.messageBus.publish('flowback.session.friction', friction);

      if (process.env.NODE_ENV === 'development') {
        console.debug(`→ session.friction (score: ${friction.payload.frictionScore.toFixed(2)}):`);
      }
    }

    // Clean old sessions (> 30 min)
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [sid, j] of this.sessionJourneys) {
      if (j.startTime < cutoff) {
        this.sessionJourneys.delete(sid);
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new CorrelatorAgent(
    new NatsMessageBus(process.env.NATS_URL || 'nats://localhost:4222')
  );
  agent.start().catch(console.error);
  process.on('SIGINT', () => agent.stop());
}
