import { NatsMessageBus } from '../services/message-bus.js';
import { InsightSummary, Agent } from '../types.js';

/**
 * Insight Agent (Optional AI)
 * Clusters similar feedback, generates insights
 * In production, would call LLM API for clustering/summarization
 */
export class InsightAgent implements Agent {
  private messageBus: NatsMessageBus;
  private feedbackBuffer: any[] = [];

  constructor(messageBus: NatsMessageBus) {
    this.messageBus = messageBus;
  }

  async start(): Promise<void> {
    await this.messageBus.connect();

    // Collect feedback and friction events
    await this.messageBus.subscribe('flowback.feedback.recorded', async (event) => {
      this.feedbackBuffer.push(event);
    });

    await this.messageBus.subscribe('flowback.session.friction', async (event) => {
      this.feedbackBuffer.push(event);
    });

    // Batch clustering every 2 minutes or on demand
    if (!process.env.DISABLE_AI_INSIGHTS) {
      setInterval(() => this.clusterAndSummarize(), 2 * 60 * 1000);
    }

    console.log('✓ Insight Agent started (AI optional)');
  }

  async stop(): Promise<void> {
    await this.messageBus.disconnect();
  }

  private async clusterAndSummarize() {
    if (this.feedbackBuffer.length < 5) {
      return; // Need minimum cluster size
    }

    try {
      // In production, call LLM clustering API
      // For now, simple rule-based clustering
      const insights = this.generateSimpleInsights(this.feedbackBuffer);

      for (const insight of insights) {
        await this.messageBus.publish('flowback.insight.summary', insight);
      }

      if (process.env.NODE_ENV === 'development') {
        console.debug(`→ Generated ${insights.length} insights`);
      }

      this.feedbackBuffer = [];
    } catch (error) {
      console.error('Error generating insights:', error);
    }
  }

  private generateSimpleInsights(events: any[]): InsightSummary[] {
    const insights: InsightSummary[] = [];

    // Count event types
    const typeCount = new Map<string, number>();
    for (const event of events) {
      const type = event.payload?.action || event.type;
      typeCount.set(type, (typeCount.get(type) || 0) + 1);
    }

    // Create insight for most common friction type
    const [topType, count] = Array.from(typeCount.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0] || [null, 0];

    if (topType && count > 2) {
      insights.push({
        clusteringRunAt: Date.now(),
        clusterId: `cluster_${topType}_${Date.now()}`,
        projectId: 'default',
        type: 'insight.summary',
        payload: {
          title: `High ${topType} friction detected`,
          description: `${count} instances of ${topType} were recorded in recent sessions.`,
          frictionType: this.mapToFrictionType(topType),
          sentimentTrend: 'negative',
          evidenceCount: count,
          hypothesis: `Users may be experiencing issues with the ${topType} flow. Consider UX review.`,
          affectedPages: ['/checkout', '/payment'],
          recommendations: [
            'Review user feedback for this flow',
            'Check error logs',
            'Consider AB test with alternative UI',
          ],
        },
      });
    }

    return insights;
  }

  private mapToFrictionType(
    type: string
  ): 'payment' | 'checkout' | 'navigation' | 'performance' | 'ux' {
    if (type.includes('rage')) return 'ux';
    if (type.includes('hesitation')) return 'ux';
    if (type.includes('payment')) return 'payment';
    return 'ux';
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new InsightAgent(
    new NatsMessageBus(process.env.NATS_URL || 'nats://localhost:4222')
  );
  agent.start().catch(console.error);
  process.on('SIGINT', () => agent.stop());
}
