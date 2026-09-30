import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

type ClarityFn = ((...args: Array<unknown>) => void) & { q?: Array<unknown> };

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

/** Hostnames allowed to record — the live production site only. */
const TRACKED_HOSTS: ReadonlyArray<string> = [
  'danskepadelmodities.com',
  'www.danskepadelmodities.com',
];

/**
 * Loads Microsoft Clarity (heatmaps + session recording) once per page load.
 * No-ops off the production host, when no project id is configured, or when
 * there is no browser window.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  readonly #document = inject(DOCUMENT);
  #loaded = false;

  load(): void {
    if (this.#loaded || !environment.clarityProjectId) return;
    const win = this.#document.defaultView;
    if (!win) return;
    if (!TRACKED_HOSTS.includes(win.location.hostname)) return;
    this.#loaded = true;

    // Queue calls made before the tag finishes downloading (official Clarity shim).
    if (!win.clarity) {
      const fn: ClarityFn = (...args: Array<unknown>) => {
        (fn.q ??= []).push(args);
      };
      win.clarity = fn;
    }

    const script = this.#document.createElement('script');
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${environment.clarityProjectId}`;
    const first = this.#document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  }
}
