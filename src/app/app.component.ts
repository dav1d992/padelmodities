import {
  Component,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { AudioService } from "./services/audio.service";
import { AdminService } from "./services/admin.service";
import { I18nService } from "./services/i18n.service";
import { ThemeService } from "./services/theme.service";
import { ConfirmDialogComponent } from "./components/confirm-dialog/confirm-dialog.component";

@Component({
  selector: "app-root",
  imports: [RouterOutlet, FormsModule, ConfirmDialogComponent],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent implements OnInit, OnDestroy {
  readonly audio = inject(AudioService);
  readonly admin = inject(AdminService);
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);

  readonly adminInputOpen = signal(false);
  readonly adminCode = signal("");
  readonly adminError = signal(false);
  readonly snowflakes = Array.from({ length: 44 }, (_, index) => ({
    index,
    delay: `${(index * 0.055).toFixed(2)}s`,
  }));
  readonly santaMorts = [
    { left: "6%", size: "2rem", duration: "16s", delay: "0s" },
    { left: "17%", size: "2.6rem", duration: "14s", delay: "0.5s" },
    { left: "34%", size: "2.2rem", duration: "18s", delay: "1s" },
    { left: "52%", size: "2.2rem", duration: "17s", delay: "1.5s" },
    { left: "68%", size: "1.9rem", duration: "13s", delay: "2s" },
    { left: "84%", size: "2.8rem", duration: "15s", delay: "2.5s" },
    { left: "96%", size: "2.1rem", duration: "19s", delay: "3s" },
  ].map((santa, index) => {
    const rotation = Math.random() * 24 - 12;
    const swing = 9 + Math.random() * 7;
    return {
      ...santa,
      index,
      rotationFrom: `${rotation}deg`,
      rotationTo: `${rotation + (index % 2 === 0 ? swing : -swing)}deg`,
      rotationDuration: `${3.5 + Math.random() * 2.5}s`,
      rotationDelay: `${-Math.random() * 4}s`,
    };
  });
  readonly lightningLeft = signal(42 + Math.random() * 16);

  toggleAdminInput(): void {
    this.adminInputOpen.set(!this.adminInputOpen());
    this.adminError.set(false);
    this.adminCode.set("");
  }

  submitAdminCode(): void {
    if (this.admin.login(this.adminCode())) {
      this.adminInputOpen.set(false);
      this.adminCode.set("");
      this.adminError.set(false);
    } else {
      this.adminError.set(true);
    }
  }

  logoutAdmin(): void {
    this.admin.logout();
    this.adminInputOpen.set(false);
  }

  toggleChristmasTheme(): void {
    const activating = !this.theme.christmas();
    this.theme.toggleChristmas();
    if (activating) this.audio.playOneShot("/assets/sounds-effects/church-bell.mp3", 0.8);
  }

  toggleHalloweenTheme(): void {
    const activating = !this.theme.halloween();
    if (activating) {
      this.lightningLeft.set(42 + Math.random() * 16);
      this.audio.activateHalloweenMusic();
    }
    this.theme.toggleHalloween();
    if (activating) this.audio.playOneShot("/assets/sounds-effects/thunder.mp3", 0.8);
  }

  // Browsers block autoplay until a user gesture — start music on the first interaction of any kind.
  readonly #unlockEvents = [
    "pointerdown",
    "touchstart",
    "keydown",
    "scroll",
  ] as const;
  readonly #unlockMusic = () => {
    this.audio.startBackground();
    if (this.audio.isPlaying()) this.removeUnlockListeners();
  };

  ngOnInit(): void {
    this.audio.startBackground();
    for (const event of this.#unlockEvents) {
      window.addEventListener(event, this.#unlockMusic, { passive: true });
    }
  }

  ngOnDestroy(): void {
    this.removeUnlockListeners();
  }

  private removeUnlockListeners(): void {
    for (const event of this.#unlockEvents) {
      window.removeEventListener(event, this.#unlockMusic);
    }
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    this.audio.startBackground();
    const element = (event.target as Element).closest(
      'button, a, input, select, textarea, [role="button"]',
    );
    if (element && !element.hasAttribute("disabled")) {
      this.audio.playClick();
    }
  }
}
