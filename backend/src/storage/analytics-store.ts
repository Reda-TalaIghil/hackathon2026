import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

/**
 * Analytics Store (Redis-backed for cross-process sharing)
 * Hot paths, sentiment timelines, friction metrics
 * Uses Redis to share data between ingest and API services
 */

interface Hotspot {
  projectId: string;
  page: string;
  rageClicks: number;
  hesitations: number;
  backtracks: number;
  frictionScore: number;
  timestamp: number;
}

interface SentimentEvent {
  projectId: string;
  sessionId: string;
  page: string;
  reaction: string;
  timestamp: number;
}

interface EvidenceRecord {
  projectId: string;
  sessionId: string;
  action: string;
  details: string;
  timestamp: number;
}

export class AnalyticsStore {
  private redisClient: RedisClientType | null = null;
  private connected = false;
  private initPromise: Promise<void> | null = null;

  // Fallback in-memory stores for demo mode (when Redis is unavailable)
  private memoryHotspots: Map<string, any> = new Map();
  private memorySentiment: Map<string, any[]> = new Map();
  private memoryEvidence: Map<string, any[]> = new Map();

  constructor(_dbPath: string = './data/analytics.db') {
    // Start async init but don't wait for it in constructor
    this.initPromise = this.initRedis();
  }

  private async initRedis() {
    try {
      this.redisClient = createClient({
        url: 'redis://localhost:6379',
        socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 500) },
      });

      this.redisClient.on('error', (err) => {
        console.error('[Analytics] Redis error:', err);
        this.connected = false;
      });

      await this.redisClient.connect();
      this.connected = true;
    } catch (error) {
      console.error('[Analytics] Failed to init Redis:', error);
      this.connected = false;
    }
  }

  private async ensureConnected() {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  init() {
    console.log('✓ Analytics store initialized (Redis-backed)');
  }

  private getHotspotKey(projectId: string, page: string) {
    return `hotspot:${projectId}:${page}`;
  }

  async recordHotspot(projectId: string, page: string, metrics: any, frictionScore: number) {
    await this.ensureConnected();
    const key = this.getHotspotKey(projectId, page);
    const hotspot: Hotspot = {
      projectId,
      page,
      rageClicks: metrics.rageClicks || 0,
      hesitations: metrics.hesitations || 0,
      backtracks: metrics.backtracks || 0,
      frictionScore,
      timestamp: Date.now(),
    };

    try {
      if (this.redisClient && this.connected) {
        await this.redisClient.setEx(key, 86400, JSON.stringify(hotspot)); // 24h TTL
        // Also track in a set for quick project queries
        await this.redisClient.sAdd(`hotspots:${projectId}:pages`, page);
      } else {
        // Fallback to in-memory storage
        this.memoryHotspots.set(key, hotspot);
      }
    } catch (error) {
      console.error('[Analytics] Error recording hotspot:', error);
      // Always fallback to memory on error
      this.memoryHotspots.set(key, hotspot);
    }
  }

  async recordSentiment(
    projectId: string,
    sessionId: string,
    page: string,
    reaction: string
  ) {
    await this.ensureConnected();
    const event: SentimentEvent = {
      projectId,
      sessionId,
      page,
      reaction,
      timestamp: Date.now(),
    };

    try {
      if (this.redisClient && this.connected) {
        // Store in list (keep last 5000)
        await this.redisClient.lPush(`sentiment:${projectId}`, JSON.stringify(event));
        await this.redisClient.lTrim(`sentiment:${projectId}`, 0, 4999);
      } else {
        // Fallback to in-memory storage
        const key = `sentiment:${projectId}`;
        if (!this.memorySentiment.has(key)) {
          this.memorySentiment.set(key, []);
        }
        const list = this.memorySentiment.get(key)!;
        list.unshift(event);
        if (list.length > 5000) {
          list.pop();
        }
      }
    } catch (error) {
      console.error('[Analytics] Error recording sentiment:', error);
      // Fallback to memory on error
      const key = `sentiment:${projectId}`;
      if (!this.memorySentiment.has(key)) {
        this.memorySentiment.set(key, []);
      }
      const list = this.memorySentiment.get(key)!;
      list.unshift(event);
    }
  }

  async recordEvidence(projectId: string, sessionId: string, action: string, details: string) {
    await this.ensureConnected();
    const record: EvidenceRecord = {
      projectId,
      sessionId,
      action,
      details,
      timestamp: Date.now(),
    };

    try {
      if (this.redisClient && this.connected) {
        // Store in list (keep last 1000)
        await this.redisClient.lPush(`evidence:${projectId}`, JSON.stringify(record));
        await this.redisClient.lTrim(`evidence:${projectId}`, 0, 999);
      } else {
        // Fallback to in-memory storage
        const key = `evidence:${projectId}`;
        if (!this.memoryEvidence.has(key)) {
          this.memoryEvidence.set(key, []);
        }
        const list = this.memoryEvidence.get(key)!;
        list.unshift(record);
        if (list.length > 1000) {
          list.pop();
        }
      }
    } catch (error) {
      console.error('[Analytics] Error recording evidence:', error);
      // Fallback to memory on error
      const key = `evidence:${projectId}`;
      if (!this.memoryEvidence.has(key)) {
        this.memoryEvidence.set(key, []);
      }
      const list = this.memoryEvidence.get(key)!;
      list.unshift(record);
    }
  }

  async getHotspots(projectId: string, limit: number = 20): Promise<Hotspot[]> {
    await this.ensureConnected();

    try {
      if (this.redisClient && this.connected) {
        const pages = await this.redisClient.sMembers(`hotspots:${projectId}:pages`);
        const hotspots: Hotspot[] = [];

        for (const page of pages.slice(0, limit)) {
          const key = this.getHotspotKey(projectId, page);
          const data = await this.redisClient.get(key);
          if (data) {
            hotspots.push(JSON.parse(data));
          }
        }

        return hotspots.sort((a, b) => b.frictionScore - a.frictionScore);
      } else {
        // Get from in-memory storage
        const hotspots: Hotspot[] = [];
        for (const [key, value] of this.memoryHotspots.entries()) {
          if (key.startsWith(`hotspot:${projectId}:`)) {
            hotspots.push(value);
          }
        }
        return hotspots.sort((a, b) => b.frictionScore - a.frictionScore).slice(0, limit);
      }
    } catch (error) {
      console.error('[Analytics] Error getting hotspots:', error);
      // Fallback to memory on error
      const hotspots: Hotspot[] = [];
      for (const [key, value] of this.memoryHotspots.entries()) {
        if (key.startsWith(`hotspot:${projectId}:`)) {
          hotspots.push(value);
        }
      }
      return hotspots.sort((a, b) => b.frictionScore - a.frictionScore).slice(0, limit);
    }
  }

  async getSentimentTrend(projectId: string, fromMs: number, toMs: number) {
    await this.ensureConnected();

    try {
      let events: SentimentEvent[] = [];

      if (this.redisClient && this.connected) {
        const rawEvents = await this.redisClient.lRange(`sentiment:${projectId}`, 0, -1);
        events = rawEvents.map((e) => JSON.parse(e) as SentimentEvent);
      } else {
        // Get from memory
        const rawEvents = this.memorySentiment.get(`sentiment:${projectId}`) || [];
        events = rawEvents;
      }

      const filtered = events.filter((e) => e.timestamp >= fromMs && e.timestamp <= toMs);

      // Group by date and reaction
      const grouped: { [key: string]: { [reaction: string]: number } } = {};

      for (const event of filtered) {
        const date = new Date(event.timestamp).toISOString().split('T')[0];
        if (!grouped[date]) {
          grouped[date] = { positive: 0, negative: 0, neutral: 0 };
        }
        grouped[date][event.reaction]++;
      }

      return Object.entries(grouped).map(([date, counts]) => ({
        date,
        ...counts,
      }));
    } catch (error) {
      console.error('[Analytics] Error getting sentiment trend:', error);
      return [];
    }
  }

  async getEvidence(projectId: string, limit: number = 10) {
    await this.ensureConnected();

    try {
      let records: EvidenceRecord[] = [];

      if (this.redisClient && this.connected) {
        const rawRecords = await this.redisClient.lRange(`evidence:${projectId}`, 0, limit - 1);
        records = rawRecords.map((r) => JSON.parse(r) as EvidenceRecord);
      } else {
        // Get from memory
        records = (this.memoryEvidence.get(`evidence:${projectId}`) || []).slice(0, limit);
      }

      return records.map((parsed) => ({
        sessionId: parsed.sessionId,
        action: parsed.action,
        details: parsed.details,
        timestamp: parsed.timestamp,
      }));
    } catch (error) {
      console.error('[Analytics] Error getting evidence:', error);
      // Fallback to memory on error
      const records = (this.memoryEvidence.get(`evidence:${projectId}`) || []).slice(0, limit);
      return records.map((parsed) => ({
        sessionId: parsed.sessionId,
        action: parsed.action,
        details: parsed.details,
        timestamp: parsed.timestamp,
      }));
    }
  }

  async close() {
    if (this.redisClient) {
      await this.redisClient.disconnect();
    }
  }
}

// Export singleton instance for shared state across services
export const analyticsStore = new AnalyticsStore();
