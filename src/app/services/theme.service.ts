import { DOCUMENT } from "@angular/common";
import { computed, effect, inject, Injectable, signal } from "@angular/core";

export type ThemeMode = "normal" | "christmas" | "halloween";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private transitionTimer?: ReturnType<typeof setTimeout>;
  private snowfallTimer?: ReturnType<typeof setTimeout>;
  private lightningTimer?: ReturnType<typeof setTimeout>;
  private initialized = false;
  readonly mode = signal<ThemeMode>("normal");
  readonly christmas = computed(() => this.mode() === "christmas");
  readonly halloween = computed(() => this.mode() === "halloween");
  readonly snowfallActive = signal(false);
  readonly snowfallLeaving = signal(false);
  readonly lightningActive = signal(false);

  constructor() {
    effect(() => {
      const changed = this.initialized;
      const mode = this.mode();
      this.document.documentElement.classList.toggle("christmas-theme", mode === "christmas");
      this.document.documentElement.classList.toggle("halloween-theme", mode === "halloween");
      this.initialized = true;

      if (changed) {
        this.document.documentElement.classList.add("theme-transitioning");
        if (this.transitionTimer) clearTimeout(this.transitionTimer);
        this.transitionTimer = setTimeout(() => {
          this.document.documentElement.classList.remove("theme-transitioning");
        }, 700);
      }
    });
  }

  toggleChristmas(): void {
    this.setMode(this.christmas() ? "normal" : "christmas");
  }

  toggleHalloween(): void {
    this.setMode(this.halloween() ? "normal" : "halloween");
  }

  setChristmas(enabled: boolean): void {
    this.setMode(enabled ? "christmas" : "normal");
  }

  setMode(mode: ThemeMode): void {
    const previousMode = this.mode();
    if (previousMode === mode) return;

    if (this.snowfallTimer) clearTimeout(this.snowfallTimer);
    if (this.lightningTimer) clearTimeout(this.lightningTimer);
    if (mode === "christmas") {
      this.snowfallActive.set(true);
      this.snowfallLeaving.set(false);
    } else if (previousMode === "christmas") {
      this.snowfallActive.set(true);
      this.snowfallLeaving.set(true);
      this.snowfallTimer = setTimeout(() => {
        this.snowfallActive.set(false);
        this.snowfallLeaving.set(false);
      }, 700);
    }

    if (mode === "halloween") {
      this.lightningActive.set(true);
      this.lightningTimer = setTimeout(() => {
        this.lightningActive.set(false);
      }, 850);
    } else {
      this.lightningActive.set(false);
    }

    this.mode.set(mode);
  }

  playerImage(shortname: string | undefined, thumbnail = false): string | null {
    if (!shortname) return null;
    const suffix = this.mode() === "normal" ? "" : `-${this.mode() === "christmas" ? "xmas" : "halloween"}`;
    const size = thumbnail ? "-thumb" : "";
    return `/assets/optimized/${shortname}-padel${suffix}${size}.webp`;
  }

  normalPlayerImage(shortname: string): string {
    return `/assets/optimized/${shortname}-padel.webp`;
  }

  railImage(shortname: string, thumbnail = false): string {
    const suffix = this.mode() === "normal" ? "" : `-${this.mode() === "christmas" ? "xmas" : "halloween"}`;
    const size = thumbnail ? "-thumb" : "";
    return `/assets/optimized/${shortname}-padel${suffix}${size}.webp`;
  }

}
