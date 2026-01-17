import { MongoClient, Db } from 'mongodb';

/**
 * MongoDB Store for persistent analytics
 * Stores hotspots, sentiment, and evidence with flexible schema
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

export class MongoStore {
  private client: MongoClient;
  private db!: Db;
  private connected = false;

  constructor(url: string = 'mongodb://localhost:27017') {
    this.client = new MongoClient(url);
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db('flowback');
      await this.createIndexes();
      this.connected = true;
      console.log('✓ Connected to MongoDB');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  private async createIndexes() {
    // Indexes for fast queries
    await this.db.collection('hotspots').createIndex({ projectId: 1, page: 1 }, { unique: true });
    await this.db.collection('sentiment').createIndex({ projectId: 1, timestamp: -1 });
    await this.db.collection('evidence').createIndex({ projectId: 1, timestamp: -1 });
  }

  async recordHotspot(projectId: string, page: string, metrics: any, frictionScore: number) {
    if (!this.connected) {
      console.warn('MongoDB not connected, skipping hotspot recording');
      return;
    }

    const hotspot: Hotspot = {
      projectId,
      page,
      rageClicks: metrics.rageClicks || 0,
      hesitations: metrics.hesitations || 0,
      backtracks: metrics.backtracks || 0,
      frictionScore,
      timestamp: Date.now(),
    };

    await this.db.collection('hotspots').updateOne(
      { projectId, page },
      { $set: hotspot },
      { upsert: true }
    );
  }

  async getHotspots(projectId: string, limit: number = 20): Promise<Hotspot[]> {
    if (!this.connected) {
      return [];
    }

    return this.db
      .collection('hotspots')
      .find({ projectId })
      .sort({ frictionScore: -1 })
      .limit(limit)
      .toArray() as Promise<Hotspot[]>;
  }

  async recordSentiment(
    projectId: string,
    sessionId: string,
    page: string,
    reaction: string
  ) {
    if (!this.connected) {
      console.warn('MongoDB not connected, skipping sentiment recording');
      return;
    }

    const event: SentimentEvent = {
      projectId,
      sessionId,
      page,
      reaction,
      timestamp: Date.now(),
    };

    await this.db.collection('sentiment').insertOne(event);
  }

  async getSentimentTrend(projectId: string, fromMs: number, toMs: number) {
    if (!this.connected) {
      return [];
    }

    const pipeline = [
      {
        $match: {
          projectId,
          timestamp: { $gte: fromMs, $lte: toMs },
        },
      },
      {
        $addFields: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $toDate: '$timestamp' },
            },
          },
        },
      },
      {
        $group: {
          _id: { date: '$date', reaction: '$reaction' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          date: '$_id.date',
          reaction: '$_id.reaction',
          count: 1,
          _id: 0,
        },
      },
      { $sort: { date: 1 } },
    ];

    return this.db.collection('sentiment').aggregate(pipeline).toArray();
  }

  async recordEvidence(
    projectId: string,
    sessionId: string,
    action: string,
    details: string
  ) {
    if (!this.connected) {
      console.warn('MongoDB not connected, skipping evidence recording');
      return;
    }

    const record: EvidenceRecord = {
      projectId,
      sessionId,
      action,
      details,
      timestamp: Date.now(),
    };

    await this.db.collection('evidence').insertOne(record);
  }

  async getEvidence(projectId: string, limit: number = 10) {
    if (!this.connected) {
      return [];
    }

    const records = await this.db
      .collection('evidence')
      .find({ projectId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return records.map((r: any) => ({
      sessionId: r.sessionId,
      action: r.action,
      details: r.details,
      timestamp: r.timestamp,
    }));
  }

  async disconnect() {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
      console.log('✓ Disconnected from MongoDB');
    }
  }
}

// Export singleton instance
export const mongoStore = new MongoStore(process.env.MONGODB_URL || 'mongodb://localhost:27017');
