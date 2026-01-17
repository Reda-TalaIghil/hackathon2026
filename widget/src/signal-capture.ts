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
    const target = (event.target as HTMLElement);
    const targetId = target.id || target.className || target.tagName;

    // Track for rage-click detection
    const now = Date.now();
    if (!this.clickBuffer.has(targetId)) {
      this.clickBuffer.set(targetId, []);
    }
    this.clickBuffer.get(targetId)!.push(now);

    // Clean old clicks (>1s old)
    const clicks = this.clickBuffer.get(targetId)!;
    const filtered = clicks.filter((t) => now - t < this.rageClickThresholdMs);
    this.clickBuffer.set(targetId, filtered);

    // Detect rage-click (3+ clicks in threshold)
    if (filtered.length >= 3) {
      const spanMs = filtered[filtered.length - 1] - filtered[0];
      if (spanMs <= this.rageClickThresholdMs) {
        console.log(`[Flowback] 🖱️ RAGE CLICK detected on: ${targetId}`);
        this.emit('signal.raw', {
          action: 'click',
          target: targetId,
          rageClick: true,
          count: filtered.length,
          spanMs,
        });
        this.clickBuffer.set(targetId, []); // Reset
        return;
      }
    }

    // Normal click
    console.log(`[Flowback] Click on: ${targetId}`);
    this.emit('signal.raw', {
      action: 'click',
      target: targetId,
    });
  }

  private captureHover(event: MouseEvent) {
    const target = (event.target as HTMLElement);
    const targetId = target.id || target.className || target.tagName;
    const now = Date.now();
    this.hoverStart.set(targetId, now);
    console.log(`[Flowback] Hover start on: ${targetId}`);
  }

  private captureHoverEnd(event: MouseEvent) {
    const target = (event.target as HTMLElement);
    const targetId = target.id || target.className || target.tagName;
    const startTime = this.hoverStart.get(targetId);
    if (startTime) {
      const dwellMs = Date.now() - startTime;
      if (dwellMs > 500) {
        // Only report significant hovers
        console.log(`[Flowback] ⏸️ HESITATION on ${targetId}: ${dwellMs}ms dwell`);
        this.emit('signal.raw', {
          action: 'hover',
          target: targetId,
          dwellMs,
        });
      }
      this.hoverStart.delete(targetId);
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
