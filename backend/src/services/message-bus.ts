import { connect, NatsConnection, Subscription } from 'nats';

/**
 * MessageBus Interface & NATS Implementation
 * Abstracted so it can be swapped for Kafka, RabbitMQ, etc.
 */

export interface MessageBus {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(topic: string, msg: any): Promise<void>;
  subscribe(
    topic: string,
    handler: (msg: any) => Promise<void>
  ): Promise<Subscription>;
}

export class NatsMessageBus implements MessageBus {
  private natsUrl: string;
  private connection: NatsConnection | null = null;

  constructor(natsUrl: string = 'nats://localhost:4222') {
    this.natsUrl = natsUrl;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await connect({ servers: this.natsUrl });
      console.log(`✓ Connected to NATS at ${this.natsUrl}`);
    } catch (error) {
      console.error('Failed to connect to NATS:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
  }

  async publish(topic: string, msg: any): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to message bus');
    }
    const payload = new TextEncoder().encode(JSON.stringify(msg));
    this.connection.publish(topic, payload);
  }

  async subscribe(
    topic: string,
    handler: (msg: any) => Promise<void>
  ): Promise<Subscription> {
    if (!this.connection) {
      throw new Error('Not connected to message bus');
    }

    const sub = this.connection.subscribe(topic);

    // Process messages
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(new TextDecoder().decode(msg.data));
          await handler(data);
        } catch (error) {
          console.error(`Error processing message on ${topic}:`, error);
        }
      }
    })();

    return sub;
  }
}
