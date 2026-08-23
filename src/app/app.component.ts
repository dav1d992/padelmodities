import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AudioService } from './services/audio.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  readonly audio = inject(AudioService);

  // Browsers block autoplay until a user gesture — start music on the first interaction of any kind.
  private readonly unlockEvents = ['pointerdown', 'touchstart', 'keydown', 'scroll'] as const;
  private readonly unlockMusic = () => {
    this.audio.startBackground();
    if (this.audio.isPlaying()) this.removeUnlockListeners();
  };

  ngOnInit(): void {
    this.audio.startBackground();
    for (const evt of this.unlockEvents) {
      window.addEventListener(evt, this.unlockMusic, { passive: true });
    }
  }

  ngOnDestroy(): void {
    this.removeUnlockListeners();
  }

  private removeUnlockListeners(): void {
    for (const evt of this.unlockEvents) {
      window.removeEventListener(evt, this.unlockMusic);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    this.audio.startBackground();
    const el = (e.target as Element).closest('button, a, input, select, textarea, [role="button"]');
    if (el && !el.hasAttribute('disabled')) {
      this.audio.playClick();
    }
  }
}
