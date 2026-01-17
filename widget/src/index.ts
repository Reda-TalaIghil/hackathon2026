import { FlowbackConfig, SessionState, SignalRaw, FeedbackRecorded } from './types';
import { SignalCapture } from './signal-capture';
import { MicroPrompt } from './micro-prompt';
import { ConsentManager } from './consent';
import { EventQueue } from './queue';
import { ThrottleManager } from './throttle';

/**
 * Main Flowback Widget
 * Orchestrates signal capture, consent, throttling, and event delivery
 */
class Flowback {
  private config: FlowbackConfig;
  private session: SessionState;
  private signalCapture: SignalCapture | null = null;
  private microPrompt: MicroPrompt | null = null;
  private consentManager: ConsentManager;
  private eventQueue: EventQueue;
  private throttle: ThrottleManager;
  private initialized: boolean = false;

  constructor(config: FlowbackConfig) {
    this.config = {
      sampleRate: 1,
      throttleMs: 30000,
      batchSize: 50,
      batchIntervalMs: 5000,
      ...config,
    };

    this.session = {
      id: this.generateSessionId(),
      projectId: config.projectId,
      startTime: Date.now(),
      consentGranted: config.consent ?? false,
      signals: [],
      feedback: [],
    };

    this.consentManager = new ConsentManager(config.projectId, (granted) => {
      this.session.consentGranted = granted;
    }, config.consent);

    this.eventQueue = new EventQueue(
      config.apiUrl,
      config.projectId,
      config.batchSize,
      config.batchIntervalMs
    );

    this.throttle = new ThrottleManager(config.throttleMs);
  }

  public init() {
    if (this.initialized) {
      console.warn('Flowback: Already initialized');
      return;
    }

    // Show consent banner only if consent not already given in config
    if (!this.session.consentGranted && this.config.consent !== true) {
      this.consentManager.showBanner();
    }

    // Start signal capture if consent granted (either from config or localStorage)
    if (this.session.consentGranted) {
      this.startCapture();
    }

    this.initialized = true;
    console.log('Flowback: Initialized', { projectId: this.config.projectId, consentGranted: this.session.consentGranted });
  }

  private startCapture() {
    this.signalCapture = new SignalCapture(
      this.session.id,
      this.session.projectId,
      (signal) => this.onSignal(signal)
    );

    this.microPrompt = new MicroPrompt(
      (reaction) => this.onReaction(reaction),
      () => {},
      this.config.promptTheme
    );

    // Randomly show prompts (after significant interactions)
    setInterval(() => {
      if (this.config.disableAI === false && Math.random() < 0.05) {
        if (this.throttle.canShowPrompt()) {
          this.microPrompt?.show();
        }
      }
    }, 5000);
  }

  private onSignal(signal: SignalRaw) {
    if (!this.session.consentGranted) {
      return;
    }

    this.session.signals.push(signal);
    this.eventQueue.add(signal);

    // Log for debugging
    if (process.env.NODE_ENV === 'development') {
      console.debug('Flowback Signal:', signal.payload.action, signal.payload);
    }
  }

  private onReaction(reaction: string) {
    if (!this.session.consentGranted) {
      return;
    }

    const feedback: FeedbackRecorded = {
      sessionId: this.session.id,
      projectId: this.session.projectId,
      timestamp: Date.now(),
      type: 'feedback.recorded',
      payload: {
        reaction: reaction as any,
        promptId: `prompt_${Date.now()}`,
        page: window.location.pathname,
      },
    };

    this.session.feedback.push(feedback);
    this.eventQueue.add(feedback);
    console.log('Flowback Reaction:', reaction);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public destroy() {
    this.signalCapture?.destroy();
    this.microPrompt?.destroy();
    this.consentManager.destroy();
    this.eventQueue.destroy();
  }

  public getSessionId(): string {
    return this.session.id;
  }
}

// Auto-initialize if config is present
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const config = (window as any).flowbackConfig;
    if (config) {
      const flowback = new Flowback(config);
      flowback.init();
      (window as any).flowback = flowback;
    }
  });
}

export default Flowback;
