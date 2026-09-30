import { Component, computed, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";import {
  FreePadelService,
  type CreateFreeTournamentInput,
} from "../../services/free-padel.service";
import { I18nService } from "../../services/i18n.service";
import { AdminService } from "../../services/admin.service";
import { ConfirmService } from "../../services/confirm.service";
import {
  DEFAULT_BONUS,
  DEFAULT_SCORING,
  isDynamicFormat,
  isTeamFormat,
  type CourtBonusConfig,
  type FreeTournament,
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
export class FreeSetupComponent implements OnInit {
  readonly #service = inject(FreePadelService);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);
  readonly admin = inject(AdminService);
  readonly #confirm = inject(ConfirmService);

  /** Admin-only browse list of every free tournament. */
  readonly showList = signal(false);
  readonly allTournaments = signal<Array<FreeTournament>>([]);
  #listLoaded = false;

  readonly formatOptions: Array<TournamentFormat> = [
    "americano",
    "team-americano",
    "mexicano",
    "team-mexicano",
    "super-mexicano",
    "mexericano",
    "king-of-the-hill",
    "beat-the-box",
  ];

  readonly scoringMethods: Array<ScoringMethod> = [
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

  // Two-phase (seating + final)
  readonly twoPhase = signal(false);
  readonly seatingFormat = signal<TournamentFormat>("beat-the-box");
  readonly seatingRounds = signal(3);
  readonly finalRounds = signal(4);
  readonly courtNames = signal<Array<string>>([
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

  #editId: string | null = null;
  #draftLoaded = false;
  get isEditing(): boolean {
    return this.#editId !== null;
  }

  readonly isKoth = computed(() => this.format() === "king-of-the-hill");
  readonly isBeatTheBox = computed(() => this.format() === "beat-the-box");
  readonly isMexericano = computed(() => this.format() === "mexericano");
  readonly isSuperMex = computed(() => this.format() === "super-mexicano");
  readonly showBonus = computed(() => this.isSuperMex() || this.isMexericano());
  readonly isRoundRobin = computed(() => this.format() === "team-americano");
  readonly isDynamic = computed(() => isDynamicFormat(this.format()));
  readonly courtCount = computed(() => this.courtNames().length);

  // Two-phase derived
  readonly isTeam = computed(() => isTeamFormat(this.format()));
  readonly seatingIsTeam = computed(() => isTeamFormat(this.seatingFormat()));
  readonly seatingIsBeatBox = computed(
    () => this.seatingFormat() === "beat-the-box",
  );
  readonly seatingIsKoth = computed(
    () => this.seatingFormat() === "king-of-the-hill",
  );
  readonly effectiveTotalRounds = computed(() =>
    this.twoPhase()
      ? this.seatingRounds() + this.finalRounds()
      : this.totalRounds(),
  );

  readonly validation = computed<{ ok: boolean; messages: Array<string> }>(() => {
    const messages: Array<string> = [];
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
    if (this.isBeatTheBox() && !this.twoPhase() && this.totalRounds() % 3 !== 0) {
      messages.push(this.i18n.t("val.beatBoxRounds"));
    }
    if (this.twoPhase()) {
      if (
        this.seatingFormat() === "team-americano" ||
        this.format() === "team-americano"
      ) {
        messages.push(this.i18n.t("val.twoPhaseNoRoundRobin"));
      } else if (this.seatingIsTeam() !== this.isTeam()) {
        messages.push(this.i18n.t("val.twoPhaseTeamMismatch"));
      }
      if (this.seatingRounds() < 1)
        messages.push(this.i18n.t("val.twoPhaseSeatingRounds"));
      if (this.finalRounds() < 1)
        messages.push(this.i18n.t("val.twoPhaseFinalRounds"));
      if (this.seatingIsBeatBox() && this.seatingRounds() % 3 !== 0)
        messages.push(this.i18n.t("val.beatBoxSeatingRounds"));
      if (this.isBeatTheBox() && this.finalRounds() % 3 !== 0)
        messages.push(this.i18n.t("val.beatBoxFinalRounds"));
      if (this.seatingIsKoth() && this.courtCount() < 2)
        messages.push(this.i18n.t("val.kothCourts"));
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
    if (f === "beat-the-box" && this.twoPhase() && this.finalRounds() % 3 !== 0) {
      this.finalRounds.set(3);
    }
  }

  selectSeatingFormat(f: TournamentFormat): void {
    this.seatingFormat.set(f);
    if (f === "beat-the-box" && this.seatingRounds() % 3 !== 0) {
      this.seatingRounds.set(3);
    }
    if (f === "king-of-the-hill" && this.courtCount() < 2) {
      this.courtNames.set([
        this.i18n.t("court.king"),
        this.i18n.t("court.default", { n: 2 }),
      ]);
    }
  }

  toggleTwoPhase(on: boolean): void {
    this.twoPhase.set(on);
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

  ngOnInit(): void {
    this.#editId = this.#route.snapshot.queryParamMap.get("edit");
    if (!this.#editId) return;
    this.#service
      .watchFreeTournament(this.#editId)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((t) => {
        if (this.#draftLoaded) return;
        if (!t || t.status !== "draft") {
          // Nothing to edit (missing or already started) — fall back to view/create.
          this.#router.navigate(this.#editId ? ["/free", this.#editId] : ["/free"]);
          return;
        }
        this.#draftLoaded = true;
        this.populateFromDraft(t);
      });
  }

  /** Toggle the admin-only list of all free tournaments (lazy-loads on first open). */
  toggleList(): void {
    if (!this.admin.isAdmin()) return;
    this.showList.set(!this.showList());
    if (this.showList() && !this.#listLoaded) {
      this.#listLoaded = true;
      this.#service
        .watchAllFreeTournaments()
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe((list) => this.allTournaments.set(list));
    }
  }

  openTournament(id: string): void {
    this.#router.navigate(["/free", id]);
  }

  async deleteFromList(t: FreeTournament, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.admin.isAdmin()) return;
    const ok = await this.#confirm.ask({
      message: this.i18n.t("free.confirmDeleteNamed", { name: t.name }),
      confirmLabel: this.i18n.t("common.deleteLabel"),
      danger: true,
    });
    if (!ok) return;
    try {
      await this.#service.deleteFreeTournament(t.id);
    } catch {
      this.error.set(this.i18n.t("common.error"));
    }
  }

  private populateFromDraft(t: FreeTournament): void {
    this.tournamentName.set(t.name ?? "");
    this.description.set(t.description ?? "");
    this.code.set(t.code ?? "");
    this.format.set(t.format);
    this.seeded.set(t.seeded ?? false);
    if (t.seatingFormat && (t.seatingRounds ?? 0) >= 1) {
      this.twoPhase.set(true);
      this.seatingFormat.set(t.seatingFormat);
      const seatingRounds = t.seatingRounds ?? 0;
      this.seatingRounds.set(seatingRounds);
      this.finalRounds.set(Math.max(1, t.totalRounds - seatingRounds));
    } else {
      this.twoPhase.set(false);
    }
    const courtNames = t.courtNames;
    const courts = courtNames
      ? Object.keys(courtNames)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => courtNames[k])
      : [];
    if (courts.length) this.courtNames.set(courts);
    this.totalRounds.set(t.totalRounds);
    this.scoring.set({ ...t.scoring });
    if (t.bonus) {
      this.bonus.set({ ...t.bonus, points: { ...t.bonus.points } });
    }
  }

  async create(): Promise<void> {
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set("");
    const twoPhase = this.twoPhase();
    const input: CreateFreeTournamentInput = {
      name: this.tournamentName(),
      description: this.description(),
      code: this.code(),
      format: this.format(),
      seatingFormat: twoPhase ? this.seatingFormat() : undefined,
      seatingRounds: twoPhase ? this.seatingRounds() : undefined,
      courtNames: this.courtNames(),
      totalRounds: twoPhase
        ? this.seatingRounds() + this.finalRounds()
        : this.totalRounds(),
      scoring: this.scoring(),
      seeded: this.seeded(),
    };
    if (this.showBonus()) input.bonus = this.bonus();
    try {
      if (this.#editId) {
        await this.#service.updateConfig(this.#editId, input);
        this.#router.navigate(["/free", this.#editId]);
      } else {
        const id = await this.#service.createFreeTournament(input);
        this.#router.navigate(["/free", id]);
      }
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
