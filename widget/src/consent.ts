import { FlowbackConfig, SessionState } from './types';

/**
 * Consent & Privacy Management
 * Handles consent banner, local storage of consent state, and data minimization
 */
export class ConsentManager {
  private projectId: string;
  private storageKey: string;
  private container: HTMLDivElement | null = null;
  private consentGranted: boolean = false;
  private onConsentChange: (granted: boolean) => void;

  constructor(projectId: string, onConsentChange: (granted: boolean) => void, initialConsent?: boolean) {
    this.projectId = projectId;
    this.storageKey = `flowback_consent_${projectId}`;
    this.onConsentChange = onConsentChange;
    this.loadConsent(initialConsent);
  }

  private loadConsent(initialConsent?: boolean) {
    const stored = localStorage.getItem(this.storageKey);
    if (stored !== null) {
      this.consentGranted = stored === 'true';
    } else if (initialConsent !== undefined) {
      // Use initial config if no stored value
      this.consentGranted = initialConsent;
    }
    this.onConsentChange(this.consentGranted);
  }

  public showBanner() {
    if (this.consentGranted || this.container) {
      return; // Already consented or banner shown
    }

    this.container = document.createElement('div');
    this.container.id = 'flowback-consent-banner';
    this.container.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #1f1f1f;
      color: #ffffff;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      font-size: 14px;
      z-index: 9999;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    const textDiv = document.createElement('div');
    textDiv.innerHTML = `
      <strong>Feedback Collection</strong><br>
      We collect behavior signals and optional reactions to improve your experience.
      <a href="#" style="color: #4a9eff; margin-left: 8px;">Privacy Policy</a>
    `;
    textDiv.style.flex = '1';
    this.container.appendChild(textDiv);

    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Accept';
    acceptBtn.style.cssText = `
      background: #4a9eff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    `;
    acceptBtn.onclick = () => this.grantConsent();
    this.container.appendChild(acceptBtn);

    const rejectBtn = document.createElement('button');
    rejectBtn.textContent = 'Reject';
    rejectBtn.style.cssText = `
      background: transparent;
      color: #999;
      border: 1px solid #666;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    `;
    rejectBtn.onclick = () => this.rejectConsent();
    this.container.appendChild(rejectBtn);

    document.body.appendChild(this.container);
  }

  private grantConsent() {
    localStorage.setItem(this.storageKey, 'true');
    this.consentGranted = true;
    this.dismissBanner();
    this.onConsentChange(true);
  }

  private rejectConsent() {
    localStorage.setItem(this.storageKey, 'false');
    this.consentGranted = false;
    this.dismissBanner();
    this.onConsentChange(false);
  }

  private dismissBanner() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  public hasConsent(): boolean {
    return this.consentGranted;
  }

  public destroy() {
    this.dismissBanner();
  }
}
