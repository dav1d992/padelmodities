import { Injectable, signal } from '@angular/core';

const KEY_MUSIC = 'padel:music-muted';
const KEY_SFX   = 'padel:sfx-muted';

@Injectable({ providedIn: 'root' })
export class AudioService {
  readonly musicMuted = signal(localStorage.getItem(KEY_MUSIC) === 'true');
  readonly sfxMuted   = signal(localStorage.getItem(KEY_SFX)   === 'true');

  private bg: HTMLAudioElement | null = null;

  startBackground(): void {
    if (!this.bg) {
      this.bg = new Audio('/assets/sounds-effects/background');
      this.bg.loop = true;
      this.bg.volume = 0.3;
      this.bg.muted = this.musicMuted();
    }
    if (!this.musicMuted()) this.bg.play().catch(() => {});
  }

  toggleMusic(): void {
    const next = !this.musicMuted();
    this.musicMuted.set(next);
    localStorage.setItem(KEY_MUSIC, String(next));
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
    localStorage.setItem(KEY_SFX, String(next));
  }

  playOneShot(src: string, volume = 0.8): void {
    if (this.sfxMuted()) return;
    const a = new Audio(src);
    a.volume = volume;
    a.play().catch(() => {});
  }

  playClick(): void { this.playOneShot('/assets/sounds-effects/click.mp3', 0.25); }
  playHover(): void { this.playOneShot('/assets/sounds-effects/hover.mp3', 0.35); }
}

