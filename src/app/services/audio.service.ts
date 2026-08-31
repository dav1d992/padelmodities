import { Injectable, signal } from '@angular/core';

const KEY_MUSIC = 'padel:music-muted';
const KEY_SFX   = 'padel:sfx-muted';

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

  private backgroundMusic: HTMLAudioElement | null = null;

  startBackground(): void {
    if (!this.backgroundMusic) {
      this.backgroundMusic = new Audio('/assets/sounds-effects/background');
      this.backgroundMusic.loop = true;
      this.backgroundMusic.volume = 0.3;
      this.backgroundMusic.muted = this.musicMuted();
    }
    if (!this.musicMuted()) this.backgroundMusic.play().catch(() => {});
  }

  isPlaying(): boolean {
    return !!this.backgroundMusic && !this.backgroundMusic.paused;
  }

  toggleMusic(): void {
    const next = !this.musicMuted();
    this.musicMuted.set(next);
    writeMuted(KEY_MUSIC, next);
    if (this.backgroundMusic) {
      this.backgroundMusic.muted = next;
      if (!next) this.backgroundMusic.play().catch(() => {});
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
    const audio = new Audio(src);
    audio.volume = volume;
    if (stopAfterMs && stopAfterMs > 0) {
      const stopTimer = setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
      }, stopAfterMs);
      audio.addEventListener('ended', () => clearTimeout(stopTimer), { once: true });
    }
    audio.play().catch(() => {});
  }

  playClick(): void { this.playOneShot('/assets/sounds-effects/click.mp3', 0.25); }
  playHover(): void { this.playOneShot('/assets/sounds-effects/hover.mp3', 0.35); }
}

