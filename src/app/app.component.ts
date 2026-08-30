import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AudioService } from './services/audio.service';
import { AdminService } from './services/admin.service';
import { I18nService } from './services/i18n.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  readonly audio = inject(AudioService);
  readonly admin = inject(AdminService);
  readonly i18n = inject(I18nService);

  readonly adminInputOpen = signal(false);
  readonly adminCode = signal('');
  readonly adminError = signal(false);

  toggleAdminInput(): void {
    this.adminInputOpen.set(!this.adminInputOpen());
    this.adminError.set(false);
    this.adminCode.set('');
  }

  submitAdminCode(): void {
    if (this.admin.login(this.adminCode())) {
      this.adminInputOpen.set(false);
      this.adminCode.set('');
      this.adminError.set(false);
    } else {
      this.adminError.set(true);
    }
  }

  logoutAdmin(): void {
    this.admin.logout();
    this.adminInputOpen.set(false);
  }

  // Browsers block autoplay until a user gesture — start music on the first interaction of any kind.
  private readonly unlockEvents = ['pointerdown', 'touchstart', 'keydown', 'scroll'] as const;
  private readonly unlockMusic = () => {
    this.audio.startBackground();
    this.audio.primeSfx();
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
