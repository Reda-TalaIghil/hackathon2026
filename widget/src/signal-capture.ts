import { SessionState, SignalRaw, FeedbackRecorded, FlowbackConfig } from './types';

/**
 * SignalCapture
 * Detects clicks, hovers, scroll depth, dwell time, hesitation, backtracks, rage-clicks
 */
export class SignalCapture {
  private sessionId: string;
  private projectId: string;
  private signals: SignalRaw[] = [];
  private hoverStart: Map<string, number> = new Map();
  private clickBuffer: Map<string, number[]> = new Map();
  private scrollDepth: number = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private idleThresholdMs: number = 3000; // 3 sec of inactivity = hesitation
  private rageClickThresholdMs: number = 500; // 3+ clicks in 500ms = rage
  private onSignal: (signal: SignalRaw) => void;

  constructor(
    sessionId: string,
    projectId: string,
    onSignal: (signal: SignalRaw) => void
  ) {
    this.sessionId = sessionId;
    this.projectId = projectId;
    this.onSignal = onSignal;
    this.attachListeners();
  }

  private attachListeners() {
    // Click capture
    document.addEventListener('click', (e) => this.captureClick(e), true);

    // Hover capture (on focusable elements)
    document.addEventListener('mouseover', (e) => this.captureHover(e), true);
    document.addEventListener('mouseout', (e) => this.captureHoverEnd(e), true);

    // Scroll depth
    window.addEventListener('scroll', () => this.captureScroll());

    // Backtrack detection (popstate = back button)
    window.addEventListener('popstate', () => this.captureBacktrack());

    // Idle detection
    document.addEventListener('mousemove', () => this.resetIdleTimer());
    document.addEventListener('keydown', () => this.resetIdleTimer());
  }

  private captureClick(event: MouseEvent) {
    const target = (event.target as HTMLElement).id || event.target?.toString();

    // Track for rage-click detection
    const now = Date.now();
    if (!this.clickBuffer.has(target)) {
      this.clickBuffer.set(target, []);
    }
    this.clickBuffer.get(target)!.push(now);

    // Clean old clicks (>1s old)
    const clicks = this.clickBuffer.get(target)!;
    const filtered = clicks.filter((t) => now - t < this.rageClickThresholdMs);
    this.clickBuffer.set(target, filtered);

    // Detect rage-click (3+ clicks in threshold)
    if (filtered.length >= 3) {
      const spanMs = filtered[filtered.length - 1] - filtered[0];
      if (spanMs <= this.rageClickThresholdMs) {
        this.emit('signal.raw', {
          action: 'click',
          target,
          rageClick: true,
          count: filtered.length,
          spanMs,
        });
        this.clickBuffer.set(target, []); // Reset
        return;
      }
    }

    // Normal click
    this.emit('signal.raw', {
      action: 'click',
      target,
    });
  }

  private captureHover(event: MouseEvent) {
    const target = (event.target as HTMLElement).id || event.target?.toString();
    const now = Date.now();
    this.hoverStart.set(target, now);
  }

  private captureHoverEnd(event: MouseEvent) {
    const target = (event.target as HTMLElement).id || event.target?.toString();
    const startTime = this.hoverStart.get(target);
    if (startTime) {
      const dwellMs = Date.now() - startTime;
      if (dwellMs > 500) {
        // Only report significant hovers
        this.emit('signal.raw', {
          action: 'hover',
          target,
          dwellMs,
        });
      }
      this.hoverStart.delete(target);
    }
  }

  private captureScroll() {
    const scrollDepth = Math.round(
      (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
    );
    if (scrollDepth > this.scrollDepth) {
      this.scrollDepth = scrollDepth;
      if (scrollDepth % 25 === 0) {
        // Report at 25%, 50%, 75%, 100%
        this.emit('signal.raw', {
          action: 'scroll',
          scrollDepth,
        });
      }
    }
  }

  private captureBacktrack() {
    this.emit('signal.raw', {
      action: 'backtrack',
    });
  }

  private resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.emit('signal.raw', {
        action: 'idle',
        idleMs: this.idleThresholdMs,
      });
    }, this.idleThresholdMs);
  }

  private emit(action: string, details: Record<string, any>) {
    const signal: SignalRaw = {
      sessionId: this.sessionId,
      projectId: this.projectId,
      timestamp: Date.now(),
      type: 'signal.raw',
      payload: {
        action: details.action,
        target: details.target,
        dwellMs: details.dwellMs,
        scrollDepth: details.scrollDepth,
        details,
      },
    };
    this.signals.push(signal);
    this.onSignal(signal);
  }

  public getSignals(): SignalRaw[] {
    return this.signals;
  }

  public clearSignals() {
    this.signals = [];
  }

  public destroy() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    // Detach listeners (simplified; in production use AbortController)
  }
}
