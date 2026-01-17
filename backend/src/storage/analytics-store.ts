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
    if (!this.redisClient || !this.connected) return;

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
      await this.redisClient.setEx(key, 86400, JSON.stringify(hotspot)); // 24h TTL
      // Also track in a set for quick project queries
      await this.redisClient.sAdd(`hotspots:${projectId}:pages`, page);
    } catch (error) {
      console.error('[Analytics] Error recording hotspot:', error);
    }
  }

  async recordSentiment(
    projectId: string,
    sessionId: string,
    page: string,
    reaction: string
  ) {
    await this.ensureConnected();
    if (!this.redisClient || !this.connected) return;

    const event: SentimentEvent = {
      projectId,
      sessionId,
      page,
      reaction,
      timestamp: Date.now(),
    };

    try {
      // Store in list (keep last 5000)
      await this.redisClient.lPush(`sentiment:${projectId}`, JSON.stringify(event));
      await this.redisClient.lTrim(`sentiment:${projectId}`, 0, 4999);
    } catch (error) {
      console.error('[Analytics] Error recording sentiment:', error);
    }
  }

  async recordEvidence(projectId: string, sessionId: string, action: string, details: string) {
    await this.ensureConnected();
    if (!this.redisClient || !this.connected) return;

    const record: EvidenceRecord = {
      projectId,
      sessionId,
      action,
      details,
      timestamp: Date.now(),
    };

    try {
      // Store in list (keep last 1000)
      await this.redisClient.lPush(`evidence:${projectId}`, JSON.stringify(record));
      await this.redisClient.lTrim(`evidence:${projectId}`, 0, 999);
    } catch (error) {
      console.error('[Analytics] Error recording evidence:', error);
    }
  }

  async getHotspots(projectId: string, limit: number = 20): Promise<Hotspot[]> {
    await this.ensureConnected();
    if (!this.redisClient || !this.connected) return [];

    try {
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
    } catch (error) {
      console.error('[Analytics] Error getting hotspots:', error);
      return [];
    }
  }

  async getSentimentTrend(projectId: string, fromMs: number, toMs: number) {
    await this.ensureConnected();
    if (!this.redisClient || !this.connected) return [];

    try {
      const events = await this.redisClient.lRange(`sentiment:${projectId}`, 0, -1);
      const filtered = events
        .map((e) => JSON.parse(e) as SentimentEvent)
        .filter((e) => e.timestamp >= fromMs && e.timestamp <= toMs);

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
    if (!this.redisClient || !this.connected) return [];

    try {
      const records = await this.redisClient.lRange(`evidence:${projectId}`, 0, limit - 1);
      return records.map((r) => {
        const parsed = JSON.parse(r) as EvidenceRecord;
        return {
          sessionId: parsed.sessionId,
          action: parsed.action,
          details: parsed.details,
          timestamp: parsed.timestamp,
        };
      });
    } catch (error) {
      console.error('[Analytics] Error getting evidence:', error);
      return [];
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
