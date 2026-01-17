import { NatsMessageBus } from '../services/message-bus.js';
import {
  SignalRaw,
  SignalNormalized,
  Agent,
} from '../types.js';

/**
 * Signal Agent
 * Normalizes raw signals, detects rage-clicks & hesitation patterns
 */
export class SignalAgent implements Agent {
  private messageBus: NatsMessageBus;
  private sessionSignalBuffer: Map<string, SignalRaw[]> = new Map();
  private HESITATION_THRESHOLD_MS = 3000;
  private RAGE_CLICK_THRESHOLD_MS = 500;

  constructor(messageBus: NatsMessageBus) {
    this.messageBus = messageBus;
  }

  async start(): Promise<void> {
    await this.messageBus.connect();
    await this.messageBus.subscribe('flowback.signal.raw', async (event) =>
      this.processSignal(event)
    );
    console.log('✓ Signal Agent started');
  }

  async stop(): Promise<void> {
    await this.messageBus.disconnect();
  }

  private async processSignal(event: SignalRaw) {
    const { sessionId } = event;

    // Buffer signals by session for pattern detection
    if (!this.sessionSignalBuffer.has(sessionId)) {
      this.sessionSignalBuffer.set(sessionId, []);
    }
    this.sessionSignalBuffer.get(sessionId)!.push(event);

    // Detect patterns
    const normalized = this.detectPatterns(sessionId, event);

    if (normalized) {
      await this.messageBus.publish('flowback.signal.normalized', normalized);
      if (process.env.NODE_ENV === 'development') {
        console.debug('→ signal.normalized:', normalized.payload.action);
      }
    }

    // Clean old buffer entries (keep only last 1 min)
    if (this.sessionSignalBuffer.get(sessionId)!.length > 100) {
      const cutoff = Date.now() - 60000;
      const filtered = this.sessionSignalBuffer
        .get(sessionId)!
        .filter((s) => s.timestamp > cutoff);
      this.sessionSignalBuffer.set(sessionId, filtered);
    }
  }

  private detectPatterns(
    sessionId: string,
    event: SignalRaw
  ): SignalNormalized | null {
    const buffer = this.sessionSignalBuffer.get(sessionId) || [];
    const { payload } = event;

    // Detect rage-clicks: 3+ clicks on same target within threshold
    if (payload.action === 'click') {
      const recentClicks = buffer.filter(
        (e) =>
          e.payload.action === 'click' &&
          e.payload.target === payload.target &&
          event.timestamp - e.timestamp < this.RAGE_CLICK_THRESHOLD_MS
      );

      if (recentClicks.length >= 3) {
        return {
          sessionId,
          projectId: event.projectId,
          timestamp: event.timestamp,
          type: 'signal.normalized',
          payload: {
            action: 'rage_click',
            target: payload.target,
            metrics: {
              count: recentClicks.length,
              spanMs: event.timestamp - recentClicks[0].timestamp,
            },
            evidence: recentClicks.map((e) => ({
              ts: e.timestamp,
              target: e.payload.target,
            })),
          },
        };
      }
    }

    // Detect hesitation: long hover or idle
    if ((payload.action === 'hover' || payload.action === 'idle') && payload.dwellMs) {
      if (payload.dwellMs >= this.HESITATION_THRESHOLD_MS) {
        return {
          sessionId,
          projectId: event.projectId,
          timestamp: event.timestamp,
          type: 'signal.normalized',
          payload: {
            action: 'hesitation',
            target: payload.target,
            metrics: {
              dwellMs: payload.dwellMs,
            },
            evidence: [{ ts: event.timestamp, action: payload.action }],
          },
        };
      }
    }

    // Detect backtrack pattern
    if (payload.action === 'backtrack') {
      return {
        sessionId,
        projectId: event.projectId,
        timestamp: event.timestamp,
        type: 'signal.normalized',
        payload: {
          action: 'backtrack',
          target: 'navigation',
          metrics: {
            count: 1,
          },
          evidence: [{ ts: event.timestamp }],
        },
      };
    }

    return null;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting Signal Agent...');
  const agent = new SignalAgent(
    new NatsMessageBus(process.env.NATS_URL || 'nats://localhost:4222')
  );
  agent.start()
    .then(() => console.log('✓ Signal Agent fully initialized'))
    .catch((err) => {
      console.error('❌ Signal Agent failed:', err);
      process.exit(1);
    });
  process.on('SIGINT', () => agent.stop());
}
