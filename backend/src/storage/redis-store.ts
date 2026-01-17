import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

/**
 * Redis Store
 * Session state, throttle windows, consent flags
 */
export class RedisStore {
  private client: RedisClientType | null = null;

  async connect(url: string = 'redis://localhost:6379') {
    try {
      this.client = createClient({ url });
      await this.client.connect();
      console.log('✓ Connected to Redis');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  async setSessionState(sessionId: string, state: any, ttlSeconds: number = 3600) {
    if (!this.client) throw new Error('Not connected');
    await this.client.setEx(
      `session:${sessionId}`,
      ttlSeconds,
      JSON.stringify(state)
    );
  }

  async getSessionState(sessionId: string) {
    if (!this.client) throw new Error('Not connected');
    const data = await this.client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async setThrottleWindow(sessionId: string, timestamp: number) {
    if (!this.client) throw new Error('Not connected');
    await this.client.setEx(`throttle:${sessionId}`, 60, String(timestamp));
  }

  async getThrottleWindow(sessionId: string): Promise<number | null> {
    if (!this.client) throw new Error('Not connected');
    const data = await this.client.get(`throttle:${sessionId}`);
    return data ? parseInt(data) : null;
  }
}
