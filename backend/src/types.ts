/**
 * Event Message Types
 */

export type SignalType = 'click' | 'hover' | 'scroll' | 'idle' | 'nav' | 'backtrack' | 'wearable';
export type FeedbackReaction = 'thumbs_up' | 'thumbs_down' | 'neutral';

export interface SignalRaw {
  sessionId: string;
  projectId: string;
  timestamp: number;
  type: 'signal.raw';
  payload: {
    action: SignalType;
    target?: string;
    dwellMs?: number;
    scrollDepth?: number;
    details?: Record<string, any>;
  };
}

export interface SignalNormalized {
  sessionId: string;
  projectId: string;
  timestamp: number;
  type: 'signal.normalized';
  payload: {
    action: 'rage_click' | 'hesitation' | 'backtrack' | 'scroll_milestone';
    target?: string;
    metrics: Record<string, number>;
    evidence: any[];
  };
}

export interface FeedbackRecorded {
  sessionId: string;
  projectId: string;
  timestamp: number;
  type: 'feedback.recorded';
  payload: {
    reaction: FeedbackReaction;
    promptId: string;
    page: string;
    dwellBeforeMs?: number;
  };
}

export interface ContextEnriched {
  sessionId: string;
  projectId: string;
  timestamp: number;
  type: 'context.enriched';
  payload: {
    page: string;
    device: 'mobile' | 'tablet' | 'desktop';
    userAgent: string;
    cohortId?: string;
    consentGranted: boolean;
    originalEvent: SignalRaw | FeedbackRecorded;
  };
}

export interface PolicyUpdated {
  sessionId: string;
  projectId: string;
  timestamp: number;
  type: 'policy.updated';
  payload: {
    canPrompt: boolean;
    reason: string;
    nextAvailableMs?: number;
  };
}

export interface SessionFriction {
  sessionId: string;
  projectId: string;
  timestamp: number;
  type: 'session.friction';
  payload: {
    path: string[]; // sequence of pages
    frictionMetrics: {
      rageClicks: number;
      hesitations: number;
      backtracks: number;
      scrollAbandonment: boolean;
    };
    frictionScore: number; // 0-1
    evidence: Array<{
      timestamp: number;
      action: string;
      details: any;
    }>;
  };
}

export interface InsightSummary {
  clusteringRunAt: number;
  clusterId: string;
  projectId: string;
  type: 'insight.summary';
  payload: {
    title: string;
    description: string;
    frictionType: 'payment' | 'checkout' | 'navigation' | 'performance' | 'ux';
    sentimentTrend: 'positive' | 'negative' | 'neutral';
    evidenceCount: number;
    hypothesis: string;
    affectedPages: string[];
    recommendations?: string[];
  };
}

export type FlowbackEvent =
  | SignalRaw
  | SignalNormalized
  | FeedbackRecorded
  | ContextEnriched
  | PolicyUpdated
  | SessionFriction
  | InsightSummary;

export interface Agent {
  start(): Promise<void>;
  stop(): Promise<void>;
}
