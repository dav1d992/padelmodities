import { DOCUMENT } from "@angular/common";
import { effect, inject, Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private transitionTimer?: ReturnType<typeof setTimeout>;
  private initialized = false;
  readonly christmas = signal(false);

  constructor() {
    effect(() => {
      const changed = this.initialized;
      this.document.documentElement.classList.toggle(
        "christmas-theme",
        this.christmas(),
      );
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
    this.setChristmas(!this.christmas());
  }

  setChristmas(enabled: boolean): void {
    this.christmas.set(enabled);
  }

  playerImage(shortname: string | undefined, thumbnail = false): string | null {
    if (!shortname) return null;
    const suffix = this.christmas() ? "-xmas" : "";
    const size = thumbnail ? "-thumb" : "";
    return `/assets/optimized/${shortname}-padel${suffix}${size}.webp`;
  }

  normalPlayerImage(shortname: string): string {
    return `/assets/optimized/${shortname}-padel.webp`;
  }

  railImage(shortname: string, thumbnail = false): string {
    const suffix = this.christmas() ? "-xmas" : "";
    const size = thumbnail ? "-thumb" : "";
    return `/assets/optimized/${shortname}-padel${suffix}${size}.webp`;
  }

}
