import { NatsMessageBus } from '../services/message-bus.js';
import { ContextEnriched, Agent } from '../types.js';

/**
 * Context Agent
 * Enriches all events with page, device, cohort, consent state
 */
export class ContextAgent implements Agent {
  private messageBus: NatsMessageBus;

  constructor(messageBus: NatsMessageBus) {
    this.messageBus = messageBus;
  }

  async start(): Promise<void> {
    await this.messageBus.connect();

    // Subscribe to both signal and feedback events
    await this.messageBus.subscribe('flowback.signal.raw', (event) =>
      this.enrichEvent(event)
    );
    await this.messageBus.subscribe('flowback.feedback.recorded', (event) =>
      this.enrichEvent(event)
    );

    console.log('✓ Context Agent started');
  }

  async stop(): Promise<void> {
    await this.messageBus.disconnect();
  }

  private async enrichEvent(event: any) {
    const enriched: ContextEnriched = {
      sessionId: event.sessionId,
      projectId: event.projectId,
      timestamp: Date.now(),
      type: 'context.enriched',
      payload: {
        page: event.payload.page || this.extractPageFromTarget(event.payload.target),
        device: this.detectDevice(),
        userAgent: 'server',
        consentGranted: true, // Would be fetched from session store in prod
        originalEvent: event,
      },
    };

    await this.messageBus.publish('flowback.context.enriched', enriched);

    if (process.env.NODE_ENV === 'development') {
      console.debug('→ context.enriched:', enriched.payload.page);
    }
  }

  private extractPageFromTarget(target?: string): string {
    // Simple heuristic: if target starts with /, it's likely a page
    if (target?.startsWith('/')) {
      return target.split('?')[0];
    }
    return target || '/unknown';
  }

  private detectDevice(): 'mobile' | 'tablet' | 'desktop' {
    // In server context, default to desktop
    // This would be overridden by actual device info from widget
    return 'desktop';
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new ContextAgent(
    new NatsMessageBus(process.env.NATS_URL || 'nats://localhost:4222')
  );
  agent.start().catch(console.error);
  process.on('SIGINT', () => agent.stop());
}
