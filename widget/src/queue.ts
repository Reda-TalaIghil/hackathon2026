import { SignalRaw, FeedbackRecorded } from './types';

/**
 * EventQueue & Batcher
 * Handles offline-first event storage, batching, and reliable POST delivery
 */
export class EventQueue {
  private queue: (SignalRaw | FeedbackRecorded)[] = [];
  private maxBatchSize: number;
  private maxBatchIntervalMs: number;
  private apiUrl: string;
  private projectId: string;
  private flushTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = navigator.onLine;
  private readonly storageKey = 'flowback_queue';

  constructor(
    apiUrl: string,
    projectId: string,
    maxBatchSize: number = 50,
    maxBatchIntervalMs: number = 5000
  ) {
    this.apiUrl = apiUrl;
    this.projectId = projectId;
    this.maxBatchSize = maxBatchSize;
    this.maxBatchIntervalMs = maxBatchIntervalMs;

    // Load any persisted events from localStorage
    this.loadFromStorage();

    // Monitor connectivity
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flush();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Flush before unload
    window.addEventListener('beforeunload', () => {
      this.flush();
      this.saveToStorage();
    });
  }

  public add(event: SignalRaw | FeedbackRecorded) {
    this.queue.push(event);

    // Flush if batch size reached
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    } else {
      // Reset interval timer
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
      }
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.maxBatchIntervalMs);
    }
  }

  public async flush() {
    if (this.queue.length === 0 || !this.isOnline) {
      return;
    }

    const batch = this.queue.splice(0, this.maxBatchSize);

    try {
      const response = await fetch(`${this.apiUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        // Re-queue on failure
        this.queue.unshift(...batch);
      }
    } catch (error) {
      console.error('Flowback: Failed to send events', error);
      // Re-queue on network error
      this.queue.unshift(...batch);
    }

    // Continue flushing if more events
    if (this.queue.length > 0 && this.isOnline) {
      setTimeout(() => this.flush(), 1000);
    }
  }

  private saveToStorage() {
    if (this.queue.length > 0) {
      try {
        localStorage.setItem(
          this.storageKey,
          JSON.stringify(this.queue.slice(0, 1000))
        ); // Cap at 1000 events
      } catch (e) {
        // QuotaExceededError
      }
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
        localStorage.removeItem(this.storageKey);
        console.log(`Flowback: Loaded ${this.queue.length} queued events`);
      }
    } catch (e) {
      console.error('Flowback: Failed to load persisted events', e);
    }
  }

  public size(): number {
    return this.queue.length;
  }

  public destroy() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flush();
    this.saveToStorage();
  }
}
