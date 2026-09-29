import { Component, computed, inject, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";import {
  FreePadelService,
  type CreateFreeTournamentInput,
} from "../../services/free-padel.service";
import { I18nService } from "../../services/i18n.service";
import {
  DEFAULT_BONUS,
  DEFAULT_SCORING,
  isDynamicFormat,
  type CourtBonusConfig,
  type ScoringConfig,
  type ScoringMethod,
  type TournamentFormat,
} from "../../models/padel.model";

@Component({
  selector: "app-free-setup",
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./free-setup.component.html",
  styleUrl: "./free-setup.component.scss",
})
export class FreeSetupComponent {
  private service = inject(FreePadelService);
  private router = inject(Router);
  readonly i18n = inject(I18nService);

  readonly formatOptions: TournamentFormat[] = [
    "americano",
    "team-americano",
    "mexicano",
    "team-mexicano",
    "super-mexicano",
    "mexericano",
    "king-of-the-hill",
    "beat-the-box",
  ];

  readonly scoringMethods: ScoringMethod[] = [
    "fixed-points",
    "first-to",
    "games-sets",
    "timed",
  ];

  readonly tournamentName = signal("");
  readonly description = signal("");
  readonly code = signal("");
  readonly format = signal<TournamentFormat>("americano");
  readonly seeded = signal(false);
  readonly courtNames = signal<string[]>([
    this.i18n.t("court.default", { n: 1 }),
    this.i18n.t("court.default", { n: 2 }),
  ]);
  readonly totalRounds = signal(7);
  readonly scoring = signal<ScoringConfig>({ ...DEFAULT_SCORING });
  readonly bonus = signal<CourtBonusConfig>({
    ...DEFAULT_BONUS,
    points: { ...DEFAULT_BONUS.points },
  });

  readonly submitting = signal(false);
  readonly error = signal("");

  readonly isKoth = computed(() => this.format() === "king-of-the-hill");
  readonly isBeatTheBox = computed(() => this.format() === "beat-the-box");
  readonly isMexericano = computed(() => this.format() === "mexericano");
  readonly isSuperMex = computed(() => this.format() === "super-mexicano");
  readonly showBonus = computed(() => this.isSuperMex() || this.isMexericano());
  readonly isRoundRobin = computed(() => this.format() === "team-americano");
  readonly isDynamic = computed(() => isDynamicFormat(this.format()));
  readonly courtCount = computed(() => this.courtNames().length);

  readonly validation = computed<{ ok: boolean; messages: string[] }>(() => {
    const messages: string[] = [];
    if (this.tournamentName().trim().length === 0) {
      messages.push(this.i18n.t("val.name"));
    }
    if (!/^\d{4}$/.test(this.code())) {
      messages.push(this.i18n.t("free.val.code"));
    }
    if (this.courtCount() < 1) messages.push(this.i18n.t("val.court"));
    if (this.isKoth() && this.courtCount() < 2) {
      messages.push(this.i18n.t("val.kothCourts"));
    }
    if (this.isBeatTheBox() && this.totalRounds() % 3 !== 0) {
      messages.push(this.i18n.t("val.beatBoxRounds"));
    }
    if (!this.isRoundRobin() && this.totalRounds() < 1) {
      messages.push(this.i18n.t("val.minRound"));
    }
    return { ok: messages.length === 0, messages };
  });

  readonly canSubmit = computed(() => this.validation().ok);

  // ── Format / scoring / courts ─────────────────────────────────────────────

  selectFormat(f: TournamentFormat): void {
    this.format.set(f);
    if (f === "king-of-the-hill" && this.courtCount() < 2) {
      this.courtNames.set([
        this.i18n.t("court.king"),
        this.i18n.t("court.default", { n: 2 }),
      ]);
    }
    // Beat the Box plays all three partner combos, so rounds must be a multiple of 3.
    if (f === "beat-the-box" && this.totalRounds() % 3 !== 0) {
      this.totalRounds.set(6);
    }
  }

  setScoringMethod(m: ScoringMethod): void {
    this.scoring.set({ ...this.scoring(), method: m });
  }

  patchScoring<K extends keyof ScoringConfig>(
    key: K,
    value: ScoringConfig[K],
  ): void {
    this.scoring.set({ ...this.scoring(), [key]: value });
  }

  addCourt(): void {
    const next = [...this.courtNames()];
    next.push(this.i18n.t("court.default", { n: next.length + 1 }));
    this.courtNames.set(next);
  }

  removeCourt(index: number): void {
    if (this.courtNames().length <= 1) return;
    this.courtNames.set(this.courtNames().filter((_, i) => i !== index));
  }

  setCourtName(index: number, name: string): void {
    const next = [...this.courtNames()];
    next[index] = name;
    this.courtNames.set(next);
  }

  bonusForCourt(index: number): number {
    return this.bonus().points[String(index)] ?? 0;
  }

  setBonusForCourt(index: number, value: number): void {
    const points = { ...this.bonus().points, [String(index)]: value };
    this.bonus.set({ ...this.bonus(), points });
  }

  patchBonus<K extends keyof CourtBonusConfig>(
    key: K,
    value: CourtBonusConfig[K],
  ): void {
    this.bonus.set({ ...this.bonus(), [key]: value });
  }

  /** Restrict the code field to at most 4 digits. */
  setCode(value: string): void {
    this.code.set(value.replace(/\D/g, "").slice(0, 4));
  }

  async create(): Promise<void> {
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set("");
    const input: CreateFreeTournamentInput = {
      name: this.tournamentName(),
      description: this.description(),
      code: this.code(),
      format: this.format(),
      courtNames: this.courtNames(),
      totalRounds: this.totalRounds(),
      scoring: this.scoring(),
      seeded: this.seeded(),
    };
    if (this.showBonus()) input.bonus = this.bonus();
    try {
      const id = await this.service.createFreeTournament(input);
      this.router.navigate(["/free", id]);
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.error"),
      );
      this.submitting.set(false);
    }
  }
}
