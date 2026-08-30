import { Injectable, signal } from '@angular/core';

const KEY_MUSIC = 'padel:music-muted';
const KEY_SFX   = 'padel:sfx-muted';

const SFX_SOURCES = [
  '/assets/sounds-effects/gate-slam.mp3',
  '/assets/sounds-effects/scifi.mp3',
  '/assets/sounds-effects/click.mp3',
  '/assets/sounds-effects/hover.mp3',
];

function readMuted(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeMuted(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable — ignore */
  }
}

@Injectable({ providedIn: 'root' })
export class AudioService {
  readonly musicMuted = signal(readMuted(KEY_MUSIC));
  readonly sfxMuted   = signal(readMuted(KEY_SFX));

  private bg: HTMLAudioElement | null = null;
  private sfx = new Map<string, HTMLAudioElement>();
  private sfxPrimed = false;

  startBackground(): void {
    if (!this.bg) {
      this.bg = new Audio('/assets/sounds-effects/background');
      this.bg.loop = true;
      this.bg.volume = 0.3;
      this.bg.muted = this.musicMuted();
    }
    if (!this.musicMuted()) this.bg.play().catch(() => {});
  }

  isPlaying(): boolean {
    return !!this.bg && !this.bg.paused;
  }

  /**
   * iOS (and Chrome on Android) only let an audio element start playing from
   * inside a user gesture. Timed effects like the portrait slam fire long after
   * the tap that navigated there, so every one-shot clip is started muted during
   * the first gesture and parked — from then on it can be replayed at any time.
   */
  primeSfx(): void {
    if (this.sfxPrimed) return;
    this.sfxPrimed = true;
    for (const src of SFX_SOURCES) {
      const a = this.getSfx(src);
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        })
        .catch(() => {
          a.muted = false;
          this.sfxPrimed = false;
        });
    }
  }

  private getSfx(src: string): HTMLAudioElement {
    let a = this.sfx.get(src);
    if (!a) {
      a = new Audio(src);
      a.preload = 'auto';
      this.sfx.set(src, a);
    }
    return a;
  }

  toggleMusic(): void {
    const next = !this.musicMuted();
    this.musicMuted.set(next);
    writeMuted(KEY_MUSIC, next);
    if (this.bg) {
      this.bg.muted = next;
      if (!next) this.bg.play().catch(() => {});
    } else if (!next) {
      this.startBackground();
    }
  }

  toggleSfx(): void {
    const next = !this.sfxMuted();
    this.sfxMuted.set(next);
    writeMuted(KEY_SFX, next);
  }

  playOneShot(src: string, volume = 0.8, stopAfterMs?: number): void {
    if (this.sfxMuted()) return;
    const a = this.getSfx(src);
    a.volume = volume; // iOS ignores this and always plays at device volume.
    a.pause();
    try { a.currentTime = 0; } catch { /* not seekable yet */ }
    if (stopAfterMs && stopAfterMs > 0) {
      const stopTimer = setTimeout(() => {
        a.pause();
        a.currentTime = 0;
      }, stopAfterMs);
      a.addEventListener('ended', () => clearTimeout(stopTimer), { once: true });
    }
    a.play().catch(() => {});
  }

  playClick(): void { this.playOneShot('/assets/sounds-effects/click.mp3', 0.25); }
  playHover(): void { this.playOneShot('/assets/sounds-effects/hover.mp3', 0.35); }
}

