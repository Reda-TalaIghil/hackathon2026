import { FeedbackReaction } from './types';

/**
 * MicroPrompt
 * 1-tap reaction UI: 👍 👎 😕
 * Minimal, non-intrusive, respects throttle policy
 */
export class MicroPrompt {
  private container: HTMLDivElement;
  private isVisible: boolean = false;
  private onReaction: (reaction: FeedbackReaction) => void;
  private onDismiss: () => void;
  private theme: 'light' | 'dark';

  constructor(
    onReaction: (reaction: FeedbackReaction) => void,
    onDismiss: () => void,
    theme: 'light' | 'dark' = 'light'
  ) {
    this.onReaction = onReaction;
    this.onDismiss = onDismiss;
    this.theme = theme;
    this.container = this.createContainer();
  }

  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'flowback-micro-prompt';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      background: ${this.theme === 'dark' ? '#2d2d2d' : '#ffffff'};
      color: ${this.theme === 'dark' ? '#ffffff' : '#000000'};
      animation: flowbackSlideUp 0.3s ease-out;
    `;

    // Add animation keyframes
    if (!document.getElementById('flowback-styles')) {
      const style = document.createElement('style');
      style.id = 'flowback-styles';
      style.textContent = `
        @keyframes flowbackSlideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .flowback-reaction-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          transition: transform 0.2s;
          padding: 0;
          margin: 0 4px;
        }
        .flowback-reaction-btn:hover {
          transform: scale(1.2);
        }
        .flowback-reaction-btn:active {
          transform: scale(0.95);
        }
        .flowback-prompt-text {
          font-size: 13px;
          margin-bottom: 4px;
          font-weight: 500;
        }
      `;
      document.head.appendChild(style);
    }

    // Add question text
    const text = document.createElement('div');
    text.className = 'flowback-prompt-text';
    text.textContent = 'How smooth was this?';
    container.appendChild(text);

    // Add reaction buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';

    const reactions: Array<{ emoji: string; value: FeedbackReaction }> = [
      { emoji: '👍', value: 'thumbs_up' },
      { emoji: '👎', value: 'thumbs_down' },
      { emoji: '😕', value: 'neutral' },
    ];

    reactions.forEach(({ emoji, value }) => {
      const btn = document.createElement('button');
      btn.className = 'flowback-reaction-btn';
      btn.textContent = emoji;
      btn.onclick = () => this.handleReaction(value);
      btn.setAttribute('aria-label', value);
      buttonContainer.appendChild(btn);
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'flowback-reaction-btn';
    closeBtn.textContent = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '4px';
    closeBtn.style.right = '4px';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.opacity = '0.5';
    closeBtn.onclick = () => this.dismiss();
    container.appendChild(closeBtn);

    container.appendChild(buttonContainer);
    document.body.appendChild(container);

    // Auto-dismiss after 8 seconds if no action
    setTimeout(() => {
      if (this.isVisible) {
        this.dismiss();
      }
    }, 8000);

    return container;
  }

  public show() {
    if (!this.isVisible) {
      this.container.style.display = 'flex';
      this.isVisible = true;
    }
  }

  public hide() {
    if (this.isVisible) {
      this.container.style.display = 'none';
      this.isVisible = false;
    }
  }

  private handleReaction(reaction: FeedbackReaction) {
    this.onReaction(reaction);
    this.dismiss();
  }

  private dismiss() {
    this.hide();
    this.onDismiss();
  }

  public destroy() {
    this.container.remove();
  }
}
