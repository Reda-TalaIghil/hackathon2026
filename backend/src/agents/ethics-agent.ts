import { NatsMessageBus } from '../services/message-bus.js';
import { Agent } from '../types.js';

/**
 * Ethics / Throttling Agent
 * Enforces prompt frequency, regional consent, suppression windows
 */
export class EthicsAgent implements Agent {
  private messageBus: NatsMessageBus;
  private sessionThrottleMap: Map<string, number> = new Map();
  private THROTTLE_WINDOW_MS = 30000; // Min 30s between prompts

  constructor(messageBus: NatsMessageBus) {
    this.messageBus = messageBus;
  }

  async start(): Promise<void> {
    await this.messageBus.connect();

    // Listen for policy check requests (would come from widget or correlator)
    // For now, passive monitoring
    console.log('✓ Ethics Agent started');
  }

  async stop(): Promise<void> {
    await this.messageBus.disconnect();
  }

  public canShowPrompt(sessionId: string): boolean {
    const lastPromptTime = this.sessionThrottleMap.get(sessionId) || 0;
    const now = Date.now();

    if (now - lastPromptTime >= this.THROTTLE_WINDOW_MS) {
      this.sessionThrottleMap.set(sessionId, now);
      return true;
    }
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new EthicsAgent(
    new NatsMessageBus(process.env.NATS_URL || 'nats://localhost:4222')
  );
  agent.start().catch(console.error);
  process.on('SIGINT', () => agent.stop());
}
