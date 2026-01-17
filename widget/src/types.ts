// Type definitions for Flowback widget events and configuration

export type SignalType = 'click' | 'hover' | 'scroll' | 'idle' | 'nav' | 'backtrack';

export type FeedbackReaction = 'thumbs_up' | 'thumbs_down' | 'neutral';

export type EventType =
  | 'signal.raw'
  | 'signal.normalized'
  | 'feedback.recorded'
  | 'context.enriched'
  | 'policy.updated';

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

export interface FlowbackConfig {
  projectId: string;
  apiUrl: string;
  consent?: boolean;
  sampleRate?: number; // 0-1, default 1
  throttleMs?: number; // min ms between prompts, default 30000
  batchSize?: number; // events per POST, default 50
  batchIntervalMs?: number; // max ms before flush, default 5000
  promptTheme?: 'light' | 'dark';
  disableAI?: boolean;
}

export interface SessionState {
  id: string;
  projectId: string;
  startTime: number;
  lastPromptTime?: number;
  consentGranted: boolean;
  signals: SignalRaw[];
  feedback: FeedbackRecorded[];
}

export interface HesitationSignal {
  timestamp: number;
  action: 'hover' | 'idle';
  target: string;
  durationMs: number;
}

export interface RageClickSignal {
  timestamp: number;
  action: 'click';
  target: string;
  count: number;
  spanMs: number;
}

export type SignalNormalized =
  | HesitationSignal
  | RageClickSignal
  | {
      timestamp: number;
      action: SignalType;
      target?: string;
    };
