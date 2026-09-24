import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'padel-christmas-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly christmas = signal(this.readStored());

  constructor() {
    effect(() => {
      this.document.documentElement.classList.toggle('christmas-theme', this.christmas());
    });
  }

  toggleChristmas(): void {
    this.setChristmas(!this.christmas());
  }

  setChristmas(enabled: boolean): void {
    this.christmas.set(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore storage errors */
    }
  }

  playerImage(shortname: string | undefined, thumbnail = false): string | null {
    if (!shortname) return null;
    const suffix = this.christmas() ? '-xmas' : '';
    const size = thumbnail ? '-thumb' : '';
    return `/assets/optimized/${shortname}-padel${suffix}${size}.webp`;
  }

  normalPlayerImage(shortname: string): string {
    return `/assets/optimized/${shortname}-padel.webp`;
  }

  railImage(shortname: string, thumbnail = false): string {
    const suffix = this.christmas() ? '-xmas' : '';
    const size = thumbnail ? '-thumb' : '';
    return `/assets/optimized/${shortname}-padel${suffix}${size}.webp`;
  }

  private readStored(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}