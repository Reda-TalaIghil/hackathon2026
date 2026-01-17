import { NatsMessageBus } from '../services/message-bus.js';
import { FeedbackRecorded, Agent } from '../types.js';

/**
 * Feedback Agent
 * Processes 1-tap reactions, ties to context/session
 */
export class FeedbackAgent implements Agent {
  private messageBus: NatsMessageBus;

  constructor(messageBus: NatsMessageBus) {
    this.messageBus = messageBus;
  }

  async start(): Promise<void> {
    await this.messageBus.connect();
    await this.messageBus.subscribe('flowback.feedback.recorded', (event) =>
      this.processFeedback(event)
    );
    console.log('✓ Feedback Agent started');
  }

  async stop(): Promise<void> {
    await this.messageBus.disconnect();
  }

  private async processFeedback(event: FeedbackRecorded) {
    const { sessionId, payload } = event;

    // Log feedback event for development
    if (process.env.NODE_ENV === 'development') {
      console.debug('✓ Feedback recorded:', {
        sessionId,
        reaction: payload.reaction,
        page: payload.page,
      });
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new FeedbackAgent(
    new NatsMessageBus(process.env.NATS_URL || 'nats://localhost:4222')
  );
  agent.start().catch(console.error);
  process.on('SIGINT', () => agent.stop());
}
