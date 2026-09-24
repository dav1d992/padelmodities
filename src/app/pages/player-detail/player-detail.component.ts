import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";
import { PadelService } from "../../services/padel.service";
import { AudioService } from "../../services/audio.service";
import { AdminService } from "../../services/admin.service";
import { I18nService } from "../../services/i18n.service";
import { ConfirmService } from "../../services/confirm.service";
import { ThemeService } from "../../services/theme.service";
import {
  DEFAULT_SKILLSET,
  SKILL_LABELS,
  SKILL_NAMES,
  type Player,
  type SkillName,
  type Skillset,
} from "../../models/padel.model";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

/** Length of the hero slide→land→shake animation (must match `heroSlideIn` in the SCSS). */
const HERO_DURATION_MS = 1050;
/** Moment (ms after the portrait renders) it "lands" and the slam sound fires. */
const IMPACT_MS = 560;

@Component({
  selector: "app-player-detail",
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: "./player-detail.component.html",
  styleUrl: "./player-detail.component.scss",
})
export class PlayerDetailComponent implements OnInit, OnDestroy {
  readonly playerId = input.required<string>();

  private service = inject(PadelService);
  private router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private confirm = inject(ConfirmService);
  readonly audioService = inject(AudioService);
  readonly admin = inject(AdminService);
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);

  readonly player = signal<Player | null>(null);
  readonly loading = signal(true);
  readonly error = signal("");
  readonly visibleSkillIndex = signal(-1);
  /** True once the portrait bitmap is downloaded and decoded, so it can animate in with pixels ready. */
  readonly heroReady = signal(false);
  /** True when the player's portrait failed to load, so the anonymous fallback is shown. */
  readonly heroFailed = signal(false);
  readonly skillLabels = SKILL_LABELS;
  readonly skillNames = SKILL_NAMES;

  // ── Admin edit state ──────────────────────────────────────────────────────
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly editError = signal("");
  readonly editName = signal("");
  readonly editShortname = signal("");
  readonly editRating = signal(1000);
  readonly editSkills = signal<Skillset>({ ...DEFAULT_SKILLSET });
  readonly editMatchesPlayed = signal(0);
  readonly editWins = signal(0);
  readonly editLosses = signal(0);
  readonly editPointsFor = signal(0);
  readonly editPointsAgainst = signal(0);

  private animationStarted = false;
  private timers: ReturnType<typeof setTimeout>[] = [];

  ngOnInit(): void {
    this.audioService.startBackground();
    this.service
      .watchPlayer(this.playerId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          this.player.set(p);
          this.loading.set(false);
          if (!p) {
            this.router.navigate(["/"]);
            return;
          }
          if (!this.animationStarted) {
            this.animationStarted = true;
            this.prepareHero(p.shortname);
          }
        },
        error: (error) => {
          this.error.set(
            error?.message
              ? this.i18n.t(error.message)
              : this.i18n.t("err.loadPlayer"),
          );
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
  }

  /**
   * The portraits are multi-megabyte PNGs, so on a phone the `<img>` would mount
   * and run its whole CSS slide-in while still empty, leaving the picture to pop
   * in afterwards. Fetching and decoding it first means the animation only starts
   * once there is something to actually see.
   */
  private prepareHero(shortname?: string): void {
    if (!shortname) {
      this.heroReady.set(true);
      this.startSkillBarSequence();
      return;
    }

    const begin = () => {
      if (this.heroReady()) return;
      this.heroReady.set(true);
      const slam = setTimeout(() => {
        this.audioService.playOneShot(
          "/assets/sounds-effects/gate-slam.mp3",
          0.9,
        );
      }, IMPACT_MS);
      this.timers.push(slam);
      this.startSkillBarSequence();
    };

    const image = new Image();
    image.onload = () => {
      const decoded =
        typeof image.decode === "function"
          ? image.decode().catch(() => undefined)
          : Promise.resolve();
      decoded.then(begin);
    };
    image.onerror = () => {
      this.heroFailed.set(true);
      begin();
    };
    image.src =
      this.theme.playerImage(shortname) ??
      this.theme.normalPlayerImage(shortname);

    // Safety net: a stalled download must never hide the portrait indefinitely.
    this.timers.push(setTimeout(begin, 8000));
  }

  private startSkillBarSequence(): void {
    this.visibleSkillIndex.set(-1);
    const startAfterMs = HERO_DURATION_MS + 250;
    const barAnimationMs = 500;
    const staggerMs = barAnimationMs;

    this.skillNames.forEach((_, index) => {
      const timer = setTimeout(
        () => {
          this.visibleSkillIndex.set(index);
          this.audioService.playOneShot(
            "/assets/sounds-effects/scifi.mp3",
            0.3,
            barAnimationMs,
          );
        },
        startAfterMs + index * staggerMs,
      );
      this.timers.push(timer);
    });
  }

  readonly imagePath = computed(() => {
    if (this.heroFailed()) return "/assets/anonimous-padel.png";
    const sn = this.player()?.shortname;
    return this.theme.playerImage(sn);
  });

  readonly winRate = computed(() => {
    const p = this.player();
    if (!p || p.matchesPlayed === 0) return null;
    return Math.round((p.wins / p.matchesPlayed) * 100);
  });

  readonly skillBars = computed(() => {
    const skillset = this.player()?.skillset ?? DEFAULT_SKILLSET;
    return this.skillNames.map((skill) => ({
      key: skill,
      label: this.skillLabels[skill],
      value: skillset[skill],
      scale: skillset[skill] / 10,
    }));
  });

  readonly ratingHistory = computed(() => {
    const hist = this.player()?.ratingHistory;
    if (!hist) return [];
    return Object.entries(hist)
      .sort(([a], [b]) => Number(a.split("_")[0]) - Number(b.split("_")[0]))
      .map(([, v]) => v as number);
  });

  readonly sparkPath = computed(() => {
    const hist = this.ratingHistory();
    if (hist.length < 2) return "";
    const W = 200,
      H = 48;
    const min = Math.min(...hist),
      max = Math.max(...hist),
      range = max - min || 1;
    const pts = hist.map(
      (v, i) => `${(i / (hist.length - 1)) * W},${H - ((v - min) / range) * H}`,
    );
    return `M ${pts.join(" L ")}`;
  });

  // ── Admin edit ─────────────────────────────────────────────────────────────

  startEdit(): void {
    const p = this.player();
    if (!p) return;
    this.editName.set(p.name);
    this.editShortname.set(p.shortname ?? "");
    this.editRating.set(p.rating);
    this.editSkills.set({ ...DEFAULT_SKILLSET, ...p.skillset });
    this.editMatchesPlayed.set(p.matchesPlayed);
    this.editWins.set(p.wins);
    this.editLosses.set(p.losses);
    this.editPointsFor.set(p.pointsFor);
    this.editPointsAgainst.set(p.pointsAgainst);
    this.editError.set("");
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.editError.set("");
  }

  updateEditSkill(skill: SkillName, rawValue: number): void {
    const nextValue = Math.max(0, Math.min(10, Math.round(rawValue)));
    this.editSkills.set({ ...this.editSkills(), [skill]: nextValue });
  }

  async saveEdit(): Promise<void> {
    const p = this.player();
    if (!p) return;
    if (!this.editName().trim()) {
      this.editError.set(this.i18n.t("err.nameRequired"));
      return;
    }
    if (
      this.editShortname().trim() &&
      !/^[a-z0-9_-]+$/i.test(this.editShortname())
    ) {
      this.editError.set(this.i18n.t("err.shortnameChars"));
      return;
    }
    this.saving.set(true);
    this.editError.set("");
    try {
      await this.service.updatePlayer(p.id, {
        name: this.editName(),
        shortname: this.editShortname() || undefined,
        rating: this.editRating(),
        skillset: this.editSkills(),
        matchesPlayed: this.editMatchesPlayed(),
        wins: this.editWins(),
        losses: this.editLosses(),
        pointsFor: this.editPointsFor(),
        pointsAgainst: this.editPointsAgainst(),
      });
      this.editing.set(false);
    } catch (error) {
      this.editError.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.error"),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async deletePlayer(): Promise<void> {
    const p = this.player();
    if (!p) return;
    if (
      !(await this.confirm.ask({
        message: this.i18n.t("detail.deleteConfirm", { name: p.name }),
        danger: true,
      }))
    )
      return;
    this.saving.set(true);
    try {
      await this.service.deletePlayer(p.id);
      this.router.navigate(["/"]);
    } catch (error) {
      this.editError.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.error"),
      );
      this.saving.set(false);
    }
  }
}
