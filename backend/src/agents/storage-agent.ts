import { NatsMessageBus } from '../services/message-bus.js';
import { AnalyticsStore } from '../storage/analytics-store.js';
import { Agent } from '../types.js';

/**
 * Storage Agent
 * Subscribes to processed events and writes to analytics store
 */
export class StorageAgent implements Agent {
  private messageBus: NatsMessageBus;
  private analyticsStore: AnalyticsStore;

  constructor(messageBus: NatsMessageBus, analyticsStore: AnalyticsStore) {
    this.messageBus = messageBus;
    this.analyticsStore = analyticsStore;
  }

  async start(): Promise<void> {
    await this.messageBus.connect();

    // Listen for friction scores
    await this.messageBus.subscribe('flowback.session.friction', async (event: any) => {
      const { sessionId, projectId, payload } = event;
      
      // Record hotspot
      this.analyticsStore.recordHotspot(
        projectId,
        payload.path[0] || '/unknown',
        payload.frictionMetrics,
        payload.frictionScore
      );

      // Record evidence
      if (payload.evidence) {
        for (const ev of payload.evidence) {
          this.analyticsStore.recordEvidence(
            projectId,
            sessionId,
            ev.action,
            JSON.stringify(ev.details || {})
          );
        }
      }

      console.log(`💾 Stored friction data: ${projectId} - score: ${payload.frictionScore.toFixed(2)}`);
    });

    // Listen for feedback
    await this.messageBus.subscribe('flowback.feedback.recorded', async (event: any) => {
      const { sessionId, projectId, payload } = event;
      
      this.analyticsStore.recordSentiment(
        projectId,
        sessionId,
        payload.page || '/unknown',
        payload.reaction
      );

      console.log(`💾 Stored feedback: ${projectId} - ${payload.reaction}`);
    });

    console.log('✓ Storage Agent started');
  }

  async stop(): Promise<void> {
    await this.messageBus.disconnect();
    this.analyticsStore.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const analyticsStore = new AnalyticsStore();
  analyticsStore.init();

  const agent = new StorageAgent(
    new NatsMessageBus(process.env.NATS_URL || 'nats://localhost:4222'),
    analyticsStore
  );
  
  agent.start().catch(console.error);
  process.on('SIGINT', () => agent.stop());
}
