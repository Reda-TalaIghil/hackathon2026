/**
 * Throttle / Rate Limiting
 * Enforces minimum time between micro-prompts per session and globally
 */
export class ThrottleManager {
  private lastPromptTime: number = 0;
  private minIntervalMs: number;
  private readonly storageKey = 'flowback_throttle';

  constructor(minIntervalMs: number = 30000) {
    this.minIntervalMs = minIntervalMs;
    this.loadFromStorage();
  }

  public canShowPrompt(): boolean {
    const now = Date.now();
    if (now - this.lastPromptTime >= this.minIntervalMs) {
      this.lastPromptTime = now;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  private saveToStorage() {
    try {
      sessionStorage.setItem(this.storageKey, String(this.lastPromptTime));
    } catch (e) {
      // Ignore storage errors
    }
  }

  private loadFromStorage() {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (stored) {
        this.lastPromptTime = parseInt(stored);
      }
    } catch (e) {
      // Ignore storage errors
    }
  }
}
