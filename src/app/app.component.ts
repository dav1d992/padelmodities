import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  animate,
  animateChild,
  query,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { AudioService } from './services/audio.service';
import { AdminService } from './services/admin.service';
import { I18nService } from './services/i18n.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  animations: [
    trigger('routeFade', [
      transition('* <=> *', [
        query(':enter', [style({ opacity: 0 })], { optional: true }),
        query(
          ':leave',
          [
            style({ position: 'absolute', top: 0, left: 0, right: 0 }),
            animate('200ms ease', style({ opacity: 0 })),
          ],
          { optional: true },
        ),
        query(
          ':enter',
          [animate('320ms 100ms ease', style({ opacity: 1 })), animateChild()],
          { optional: true },
        ),
      ]),
    ]),
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  readonly audio = inject(AudioService);
  readonly admin = inject(AdminService);
  readonly i18n = inject(I18nService);

  prepareRoute(outlet: RouterOutlet): string {
    return outlet?.isActivated
      ? outlet.activatedRoute.snapshot.routeConfig?.path ?? ''
      : '';
  }

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
