import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { FreePadelService } from "../../services/free-padel.service";
import { FreeAccessService } from "../../services/free-access.service";
import { I18nService } from "../../services/i18n.service";
import { ConfirmService } from "../../services/confirm.service";
import {
  isDynamicFormat,
  isTeamFormat,
  type FreeParticipant,
  type FreeTournament,
  type KothStats,
  type StandingRow,
  type TournamentMatch,
  type TournamentRound,
  type TournamentTeam,
} from "../../models/padel.model";
import {
  computeKothStats,
  computeStandings,
  validateScore,
} from "../../services/tournament-engine";

interface MatchScore {
  score1: number | null;
  score2: number | null;
}

interface LadderCourt {
  courtIndex: number;
  courtName: string;
  isKing: boolean;
  match: TournamentMatch;
}

@Component({
  selector: "app-free-view",
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./free-view.component.html",
  styleUrl: "./free-view.component.scss",
})
export class FreeViewComponent implements OnInit {
  readonly tournamentId = input.required<string>();

  private service = inject(FreePadelService);
  private access = inject(FreeAccessService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tournament = signal<FreeTournament | null>(null);
  readonly loading = signal(true);
  readonly error = signal("");

  readonly viewRound = signal<number | null>(null);
  readonly scores = signal<Record<string, MatchScore>>({});

  // Unlock keypad
  readonly keypadOpen = signal(false);
  readonly codeEntry = signal("");
  readonly unlockError = signal(false);

  // Participant / team editing
  readonly newParticipant = signal("");
  readonly editingId = signal<string | null>(null);
  readonly editName = signal("");
  readonly teamPick = signal<string[]>([]);
  readonly teamName = signal("");

  readonly starting = signal(false);
  readonly completing = signal(false);
  readonly regenerating = signal(false);
  readonly runningFinal = signal(false);
  readonly finishing = signal(false);
  readonly deleting = signal(false);

  ngOnInit(): void {
    this.service
      .watchFreeTournament(this.tournamentId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (t) => {
          this.tournament.set(t);
          this.loading.set(false);
          if (!t) {
            this.router.navigate(["/free"]);
            return;
          }
          if (t.status === "finished" && this.viewRound() === null) {
            this.viewRound.set(0);
          }
          this.syncScores(t);
        },
        error: (err) => {
          this.error.set(err?.message ?? "Fejl.");
          this.loading.set(false);
        },
      });
  }

  // ── Access / unlock ────────────────────────────────────────────────────────

  readonly unlocked = computed(() => this.access.isUnlocked(this.tournamentId()));

  openKeypad(): void {
    this.keypadOpen.set(true);
    this.codeEntry.set("");
    this.unlockError.set(false);
  }

  closeKeypad(): void {
    this.keypadOpen.set(false);
    this.codeEntry.set("");
    this.unlockError.set(false);
  }

  pressDigit(d: number): void {
    if (this.codeEntry().length >= 4) return;
    this.unlockError.set(false);
    this.codeEntry.set(this.codeEntry() + d);
    if (this.codeEntry().length === 4) this.submitCode();
  }

  backspace(): void {
    this.unlockError.set(false);
    this.codeEntry.set(this.codeEntry().slice(0, -1));
  }

  submitCode(): void {
    const t = this.tournament();
    if (!t) return;
    if (this.access.unlock(this.tournamentId(), this.codeEntry(), t.code)) {
      this.keypadOpen.set(false);
      this.codeEntry.set("");
      this.unlockError.set(false);
    } else {
      this.unlockError.set(true);
      this.codeEntry.set("");
    }
  }

  lock(): void {
    this.access.lock(this.tournamentId());
  }

  /** True when the user may edit this tournament (unlocked with the code). */
  readonly canEdit = computed(() => this.unlocked());

  // ── Format flags ───────────────────────────────────────────────────────────

  readonly isTeam = computed(() =>
    this.tournament() ? isTeamFormat(this.tournament()!.format) : false,
  );
  readonly isDynamic = computed(() =>
    this.tournament() ? isDynamicFormat(this.tournament()!.format) : false,
  );
  readonly isKoth = computed(
    () => this.tournament()?.format === "king-of-the-hill",
  );
  readonly isMexericano = computed(
    () => this.tournament()?.format === "mexericano",
  );
  readonly isDraft = computed(() => this.tournament()?.status === "draft");
  readonly isActive = computed(() => this.tournament()?.status === "active");
  readonly isFinished = computed(
    () => this.tournament()?.status === "finished",
  );

  // ── Participants / teams ─────────────────────────────────────────────────

  readonly participants = computed<FreeParticipant[]>(() =>
    Object.values(this.tournament()?.participants ?? {}),
  );

  readonly teams = computed<TournamentTeam[]>(() =>
    Object.values(this.tournament()?.teams ?? {}),
  );

  /** Participants not yet assigned to a team (team formats). */
  readonly availableForTeams = computed<FreeParticipant[]>(() => {
    const used = new Set(this.teams().flatMap((t) => [t.p1, t.p2]));
    return this.participants().filter((p) => !used.has(p.id));
  });

  async addParticipant(): Promise<void> {
    const name = this.newParticipant().trim();
    if (!name || !this.canEdit()) return;
    this.newParticipant.set("");
    try {
      await this.service.addParticipant(this.tournamentId(), name);
    } catch (e) {
      this.setError(e);
    }
  }

  startEdit(p: FreeParticipant): void {
    this.editingId.set(p.id);
    this.editName.set(p.name);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editName.set("");
  }

  async saveEdit(pid: string): Promise<void> {
    const name = this.editName().trim();
    if (!name) return;
    try {
      await this.service.renameParticipant(this.tournamentId(), pid, name);
      this.cancelEdit();
    } catch (e) {
      this.setError(e);
    }
  }

  async removeParticipant(p: FreeParticipant): Promise<void> {
    const ok = await this.confirm.ask({
      message: this.i18n.t("free.confirmRemoveParticipant", { name: p.name }),
      confirmLabel: this.i18n.t("common.deleteLabel"),
    });
    if (!ok) return;
    try {
      await this.service.removeParticipant(this.tournamentId(), p.id);
    } catch (e) {
      this.setError(e);
    }
  }

  toggleTeamPick(id: string): void {
    const current = this.teamPick();
    if (current.includes(id)) {
      this.teamPick.set(current.filter((x) => x !== id));
    } else if (current.length < 2) {
      this.teamPick.set([...current, id]);
    }
  }

  isPicked(id: string): boolean {
    return this.teamPick().includes(id);
  }

  async addTeam(): Promise<void> {
    const pick = this.teamPick();
    if (pick.length !== 2) return;
    const name =
      this.teamName().trim() ||
      `${this.participantName(pick[0])} & ${this.participantName(pick[1])}`;
    const team: TournamentTeam = {
      id: crypto.randomUUID(),
      name,
      p1: pick[0],
      p2: pick[1],
    };
    this.teamPick.set([]);
    this.teamName.set("");
    try {
      await this.service.setTeams(this.tournamentId(), [...this.teams(), team]);
    } catch (e) {
      this.setError(e);
    }
  }

  async removeTeam(teamId: string): Promise<void> {
    try {
      await this.service.setTeams(
        this.tournamentId(),
        this.teams().filter((t) => t.id !== teamId),
      );
    } catch (e) {
      this.setError(e);
    }
  }

  /** Whether there are enough participants/teams to start. */
  readonly canStart = computed(() => {
    if (!this.canEdit() || !this.isDraft()) return false;
    if (this.isTeam()) return this.teams().length >= 2;
    if (this.isKoth()) {
      return this.participants().length >= (this.tournament()?.courtCount ?? 1) * 4;
    }
    return this.participants().length >= 4;
  });

  async start(): Promise<void> {
    if (!this.canStart() || this.starting()) return;
    this.starting.set(true);
    this.error.set("");
    try {
      await this.service.startFreeTournament(this.tournamentId());
    } catch (e) {
      this.setError(e);
    } finally {
      this.starting.set(false);
    }
  }

  // ── Round navigation ─────────────────────────────────────────────────────

  private displayRoundIndexOf(t: FreeTournament): number {
    return this.viewRound() ?? t.currentRound;
  }

  readonly displayRound = computed(() => {
    const t = this.tournament();
    return t ? this.displayRoundIndexOf(t) : 0;
  });

  readonly isCurrentRound = computed(() => {
    const t = this.tournament();
    return !!t && this.displayRound() === t.currentRound;
  });

  readonly hasPrevRound = computed(() => this.displayRound() > 0);

  readonly hasNextRound = computed(() => {
    const t = this.tournament();
    if (!t) return false;
    return (t.rounds?.[this.displayRound() + 1] ?? null) !== null;
  });

  readonly totalGeneratedRounds = computed(() =>
    Object.keys(this.tournament()?.rounds ?? {}).length,
  );

  prevRound(): void {
    if (this.hasPrevRound()) this.viewRound.set(this.displayRound() - 1);
    this.reloadScores();
  }

  nextRound(): void {
    if (this.hasNextRound()) this.viewRound.set(this.displayRound() + 1);
    this.reloadScores();
  }

  private reloadScores(): void {
    const t = this.tournament();
    if (t) this.syncScores(t);
  }

  // ── Round / match data ─────────────────────────────────────────────────────

  readonly currentRound = computed<TournamentRound | null>(() => {
    const t = this.tournament();
    if (!t) return null;
    return t.rounds?.[this.displayRound()] ?? null;
  });

  readonly currentMatches = computed<TournamentMatch[]>(() => {
    const round = this.currentRound();
    if (!round?.matches) return [];
    return Object.values(round.matches).sort(
      (a, b) => a.courtIndex - b.courtIndex,
    );
  });

  readonly ladder = computed<LadderCourt[]>(() => {
    if (!this.isKoth()) return [];
    return this.currentMatches().map((m) => ({
      courtIndex: m.courtIndex,
      courtName: this.courtName(m.courtIndex),
      isKing: m.courtIndex === 0,
      match: m,
    }));
  });

  readonly isFinalRound = computed(() => !!this.currentRound()?.isFinal);

  courtName(index: number): string {
    return (
      this.tournament()?.courtNames?.[String(index)] ??
      this.i18n.t("court.default", { n: index + 1 })
    );
  }

  // ── Names ───────────────────────────────────────────────────────────────

  participantName(id: string): string {
    const t = this.tournament();
    const team = Object.values(t?.teams ?? {}).find((x) => x.id === id);
    if (team) return team.name;
    const p = Object.values(t?.participants ?? {}).find((x) => x.id === id);
    return p?.name ?? id.slice(0, 6);
  }

  teamLabel(teamId?: string): string {
    if (!teamId) return "";
    return (
      Object.values(this.tournament()?.teams ?? {}).find((x) => x.id === teamId)
        ?.name ?? ""
    );
  }

  // ── Standings / KotH ──────────────────────────────────────────────────────

  readonly standings = computed<StandingRow[]>(() => {
    const t = this.tournament();
    if (!t) return [];
    return computeStandings(t, (id) => this.participantName(id));
  });

  readonly kothStats = computed<Record<string, KothStats>>(() => {
    const t = this.tournament();
    if (!t || !this.isKoth()) return {};
    return computeKothStats(t);
  });

  kothMovementIcon(id: string): string {
    const s = this.kothStats()[id];
    if (!s) return "";
    switch (s.lastMovement) {
      case "up":
      case "stay-top":
        return "↑";
      case "down":
      case "stay-bottom":
        return "↓";
      default:
        return "•";
    }
  }

  readonly winnerName = computed<string>(() => {
    const t = this.tournament();
    if (!t || !this.isFinished()) return "";
    return this.standings()[0]?.name ?? "";
  });

  // ── Score entry ─────────────────────────────────────────────────────────

  private syncScores(t: FreeTournament): void {
    const round = t.rounds?.[this.displayRoundIndexOf(t)];
    if (!round?.matches) return;
    const next = { ...this.scores() };
    for (const match of Object.values(round.matches)) {
      next[match.id] = {
        score1: match.score1 ?? null,
        score2: match.score2 ?? null,
      };
    }
    this.scores.set(next);
  }

  getScore(matchId: string): MatchScore {
    return this.scores()[matchId] ?? { score1: null, score2: null };
  }

  setScore(matchId: string, field: "score1" | "score2", value: string): void {
    const parsed = value === "" ? null : Number(value);
    const current = this.getScore(matchId);
    this.scores.set({
      ...this.scores(),
      [matchId]: { ...current, [field]: parsed },
    });
  }

  readonly allScoresEntered = computed(() => {
    const matches = this.currentMatches();
    if (matches.length === 0) return false;
    return matches.every((m) => {
      const s = this.scores()[m.id];
      return s !== undefined && s.score1 !== null && s.score2 !== null;
    });
  });

  scoreError(matchId: string): string {
    const t = this.tournament();
    if (!t) return "";
    const s = this.getScore(matchId);
    if (s.score1 === null || s.score2 === null) return "";
    const v = validateScore(s.score1, s.score2, t.scoring, t.format);
    return v.valid
      ? ""
      : this.i18n.t(v.reason ?? "err.invalidScore", v.reasonParams);
  }

  async saveScore(matchId: string): Promise<void> {
    if (!this.canEdit()) return;
    const s = this.getScore(matchId);
    if (s.score1 === null || s.score2 === null) return;
    const t = this.tournament();
    if (t) {
      const v = validateScore(s.score1, s.score2, t.scoring, t.format);
      if (!v.valid) {
        this.error.set(this.i18n.t(v.reason ?? "err.invalidScore", v.reasonParams));
        return;
      }
    }
    this.error.set("");
    try {
      await this.service.saveMatchScore(
        this.tournamentId(),
        this.displayRound(),
        matchId,
        s.score1,
        s.score2,
      );
    } catch (e) {
      this.setError(e);
    }
  }

  async resetScore(matchId: string): Promise<void> {
    if (!this.canEdit()) return;
    this.scores.set({
      ...this.scores(),
      [matchId]: { score1: null, score2: null },
    });
    try {
      await this.service.resetMatchScore(
        this.tournamentId(),
        this.displayRound(),
        matchId,
      );
    } catch (e) {
      this.setError(e);
    }
  }

  // ── Round actions ─────────────────────────────────────────────────────────

  async completeRound(): Promise<void> {
    if (!this.canEdit() || !this.allScoresEntered()) return;
    this.completing.set(true);
    this.error.set("");
    for (const match of this.currentMatches()) await this.saveScore(match.id);
    try {
      await this.service.completeRound(this.tournamentId());
      this.scores.set({});
      this.viewRound.set(null);
    } catch (e) {
      this.setError(e);
    } finally {
      this.completing.set(false);
    }
  }

  readonly canRegenerate = computed(() => {
    const round = this.currentRound();
    return (
      this.canEdit() &&
      this.isDynamic() &&
      this.isCurrentRound() &&
      !this.isFinished() &&
      !round?.completed &&
      !Object.values(round?.matches ?? {}).some(
        (m) => m.score1 !== undefined || m.score2 !== undefined,
      )
    );
  });

  async regenerate(): Promise<void> {
    if (!this.canRegenerate()) return;
    this.regenerating.set(true);
    this.error.set("");
    try {
      await this.service.regenerateCurrentRound(this.tournamentId());
      this.scores.set({});
    } catch (e) {
      this.setError(e);
    } finally {
      this.regenerating.set(false);
    }
  }

  readonly canRunFinal = computed(() => {
    const t = this.tournament();
    if (!t || !this.canEdit() || !this.isMexericano() || !this.isActive())
      return false;
    const rounds = Object.values(t.rounds ?? {});
    return (
      rounds.filter((r) => r.completed).length >= 1 &&
      !rounds.some((r) => r.isFinal) &&
      this.isCurrentRound()
    );
  });

  async runFinal(): Promise<void> {
    if (!this.canRunFinal()) return;
    this.runningFinal.set(true);
    this.error.set("");
    try {
      await this.service.runFinalRound(this.tournamentId());
      this.scores.set({});
    } catch (e) {
      this.setError(e);
    } finally {
      this.runningFinal.set(false);
    }
  }

  async finish(): Promise<void> {
    if (!this.canEdit()) return;
    const ok = await this.confirm.ask({
      message: this.i18n.t("view.confirmFinish"),
      confirmLabel: this.i18n.t("view.finish"),
    });
    if (!ok) return;
    this.finishing.set(true);
    this.error.set("");
    try {
      await this.service.finishTournament(this.tournamentId());
    } catch (e) {
      this.setError(e);
    } finally {
      this.finishing.set(false);
    }
  }

  async deleteTournament(): Promise<void> {
    if (!this.canEdit()) return;
    const ok = await this.confirm.ask({
      message: this.i18n.t("free.confirmDelete"),
      confirmLabel: this.i18n.t("common.deleteLabel"),
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    try {
      await this.service.deleteFreeTournament(this.tournamentId());
      this.router.navigate(["/free"]);
    } catch (e) {
      this.setError(e);
      this.deleting.set(false);
    }
  }

  private setError(e: unknown): void {
    this.error.set(
      e instanceof Error ? this.i18n.t(e.message) : this.i18n.t("common.error"),
    );
  }
}
