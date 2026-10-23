import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { PadelService, type CourtScore } from "../../services/padel.service";
import { AdminService } from "../../services/admin.service";
import { I18nService } from "../../services/i18n.service";
import { ThemeService } from "../../services/theme.service";
import { ConfirmService } from "../../services/confirm.service";
import {
  isDynamicFormat,
  isTeamFormat,
  isTwoPhase,
  isSeatingRound,
  phaseFormatFor,
  ELO_K,
  PLACEMENT_RATING_PER_PLAYER,
  type KothStats,
  type Player,
  type StandingRow,
  type Tournament,
  type TournamentMatch,
  type TournamentRound,
} from "../../models/padel.model";
import {
  beatTheBoxSeatingBlock,
  completeCurrentRound,
  computeKothStats,
  computeStandings,
  breakEvenPlacements,
  expectedPlacements,
  generateInitialRounds,
  placementEloDeltas,
  regenerateCurrentRound,
  runFinalRound,
  standingRatings,
  validateScore,
} from "../../services/tournament-engine";
import { CommonModule } from "@angular/common";
import { ImgFallbackDirective } from "../../directives/img-fallback.directive";

interface MatchScore {
  score1: number | null;
  score2: number | null;
}

function sameScore(a: MatchScore, b: MatchScore): boolean {
  return a.score1 === b.score1 && a.score2 === b.score2;
}

interface LadderCourt {
  courtIndex: number;
  courtName: string;
  isKing: boolean;
  match: TournamentMatch;
}

interface BoxCourtEntry {
  roundIndex: number;
  match: TournamentMatch;
}

/** One beat-the-box court with all its matches across the displayed block. */
interface BoxCourt {
  courtIndex: number;
  playerIds: Array<string>;
  entries: Array<BoxCourtEntry>;
}

@Component({
  selector: "app-tournament-view",
  imports: [CommonModule, FormsModule, RouterLink, ImgFallbackDirective],
  templateUrl: "./tournament-view.component.html",
  styleUrl: "./tournament-view.component.scss",
})
export class TournamentViewComponent implements OnInit {
  readonly tournamentId = input.required<string>();

  readonly #service = inject(PadelService);
  readonly #router = inject(Router);
  readonly #confirm = inject(ConfirmService);
  readonly admin = inject(AdminService);
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);

  /** Live tournament from Firebase. */
  readonly #liveTournament = signal<Tournament | null>(null);
  /** In-memory sandbox copy used while test mode is on (never persisted). */
  readonly #sandbox = signal<Tournament | null>(null);
  /** When true, all play happens on the sandbox copy with no writes. */
  readonly testMode = signal(false);

  /** Effective tournament shown and played (sandbox copy in test mode). */
  readonly tournament = computed<Tournament | null>(() =>
    this.testMode() ? this.#sandbox() : this.#liveTournament(),
  );

  readonly players = signal<Array<Player>>([]);
  readonly loading = signal(true);
  readonly error = signal("");
  readonly completing = signal(false);
  readonly finishing = signal(false);
  readonly regenerating = signal(false);
  readonly runningFinal = signal(false);
  readonly deleting = signal(false);

  /** Whether the tournament description is expanded past its collapsed clamp. */
  readonly descExpanded = signal(false);

  private readonly descText =
    viewChild<ElementRef<HTMLParagraphElement>>("descText");

  /** Toggle the description with a fold animation in both directions. */
  toggleDesc(): void {
    const el = this.descText()?.nativeElement;
    if (!el) {
      this.descExpanded.update((v) => !v);
      return;
    }

    if (this.descExpanded()) {
      // Collapse: pin the full height, then shrink back to the clamp height.
      el.style.maxHeight = `${el.scrollHeight}px`;
      void el.offsetHeight; // force reflow so the next change animates
      this.descExpanded.set(false);
      el.style.maxHeight = ""; // falls back to the CSS clamp height
    } else {
      // Expand: grow from the clamp height to the full content height.
      this.descExpanded.set(true);
      el.style.maxHeight = `${el.scrollHeight}px`;
      el.addEventListener(
        "transitionend",
        () => {
          if (this.descExpanded()) el.style.maxHeight = "none";
        },
        { once: true },
      );
    }
  }

  /** Round the user is currently viewing (null → follow current round). */
  readonly viewRound = signal<number | null>(null);

  /** Local score state: matchId → { score1, score2 } */
  readonly scores = signal<Record<string, MatchScore>>({});

  /** Last saved scores seen from the database, used to detect unsaved local edits. */
  #syncedScores: Record<string, MatchScore> = {};

  /** Court index whose results are being saved. */
  readonly savingCourt = signal<number | null>(null);

  readonly #destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.#service
      .watchTournament(this.tournamentId())
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (tournament) => {
          this.#liveTournament.set(tournament);
          this.loading.set(false);
          if (!tournament) {
            this.#router.navigate(["/"]);
            return;
          }
          // While testing, the sandbox drives the view — ignore live updates.
          if (this.testMode()) return;
          // Finished tournaments always open at round 1 (index 0).
          if (tournament.status === "finished" && this.viewRound() === null) {
            this.viewRound.set(0);
          }
          this.syncScores(tournament);
        },
        error: (error) => {
          this.error.set(error?.message ?? "Fejl.");
          this.loading.set(false);
        },
      });
    this.#service
      .watchPlayers()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((list) => this.players.set(list));
  }

  /**
   * Pre-populate local scores from saved values for the displayed round(s).
   * Unsaved local edits survive realtime updates unless that match changed remotely.
   */
  private syncScores(tournament: Tournament): void {
    const next = { ...this.scores() };
    for (const index of this.displayedRoundsOf(tournament)) {
      const round = tournament.rounds?.[index];
      for (const match of Object.values(round?.matches ?? {})) {
        const saved: MatchScore = {
          score1: match.score1 ?? null,
          score2: match.score2 ?? null,
        };
        const previous = this.#syncedScores[match.id];
        const local = next[match.id];
        const remoteChanged = !previous || !sameScore(saved, previous);
        const hasLocalEdit =
          !!local && !!previous && !sameScore(local, previous);
        if (remoteChanged || !hasLocalEdit) {
          next[match.id] = saved;
        }
        this.#syncedScores[match.id] = saved;
      }
    }
    this.scores.set(next);
  }

  private displayRoundIndexOf(tournament: Tournament): number {
    const v = this.viewRound();
    return v ?? tournament.currentRound;
  }

  /** Rounds shown together: a whole beat-the-box seating block, else one round. */
  private displayedRoundsOf(tournament: Tournament): Array<number> {
    const index = this.displayRoundIndexOf(tournament);
    const block = beatTheBoxSeatingBlock(tournament, index).filter(
      (i) => tournament.rounds?.[i] != null,
    );
    return block.length > 0 ? block : [index];
  }

  // ── Format flags ──────────────────────────────────────────────────────────

  readonly isTeam = computed(() => {
    const t = this.tournament();
    return t ? isTeamFormat(t.format) : false;
  });
  readonly isDynamic = computed(() => {
    const t = this.tournament();
    return t ? isDynamicFormat(t.format) : false;
  });
  readonly isKoth = computed(
    () => this.tournament()?.format === "king-of-the-hill",
  );
  readonly isSuperMex = computed(
    () => this.tournament()?.format === "super-mexicano",
  );
  readonly isMexericano = computed(
    () => this.tournament()?.format === "mexericano",
  );
  readonly hasBonus = computed(() => !!this.tournament()?.bonus?.enabled);
  readonly isDraft = computed(() => this.tournament()?.status === "draft");
  readonly isActive = computed(() => this.tournament()?.status === "active");
  readonly isFinished = computed(
    () => this.tournament()?.status === "finished",
  );

  /** Whether this tournament runs a seating phase then a final phase. */
  readonly isTwoPhase = computed(() => {
    const t = this.tournament();
    return !!t && isTwoPhase(t);
  });

  /** Rounds in the final phase (two-phase only). */
  readonly finalPhaseRounds = computed(() => {
    const t = this.tournament();
    if (!t || !isTwoPhase(t)) return 0;
    return Math.max(0, (t.totalRounds ?? 0) - (t.seatingRounds ?? 0));
  });

  /** Whether the currently displayed round is in the seating phase. */
  readonly currentPhaseSeating = computed(() => {
    const t = this.tournament();
    return !!t && isSeatingRound(t, this.displayRound());
  });

  // ── Round navigation ────────────────────────────────────────────────────

  readonly displayRound = computed(() => {
    const tournament = this.tournament();
    if (!tournament) return 0;
    return this.displayRoundIndexOf(tournament);
  });

  readonly displayedRounds = computed<Array<number>>(() => {
    const tournament = this.tournament();
    return tournament ? this.displayedRoundsOf(tournament) : [];
  });

  readonly #firstDisplayed = computed(
    () => this.displayedRounds()[0] ?? this.displayRound(),
  );
  readonly #lastDisplayed = computed(
    () =>
      this.displayedRounds()[this.displayedRounds().length - 1] ??
      this.displayRound(),
  );

  /** "3" for a single round, "1–3" for a beat-the-box block. */
  readonly displayedRoundsLabel = computed(() => {
    const first = this.#firstDisplayed() + 1;
    const last = this.#lastDisplayed() + 1;
    return first === last ? `${first}` : `${first}–${last}`;
  });

  /** True when the displayed rounds form a beat-the-box seating block. */
  readonly isBoxBlock = computed(() => {
    const tournament = this.tournament();
    return (
      !!tournament &&
      beatTheBoxSeatingBlock(tournament, this.displayRound()).length > 0
    );
  });

  readonly isCurrentRound = computed(() => {
    const tournament = this.tournament();
    return (
      !!tournament && this.displayedRounds().includes(tournament.currentRound)
    );
  });

  readonly hasPrevRound = computed(() => this.#firstDisplayed() > 0);

  readonly hasNextRound = computed(() => {
    const tournament = this.tournament();
    if (!tournament) return false;
    return (tournament.rounds?.[this.#lastDisplayed() + 1] ?? null) !== null;
  });

  readonly totalGeneratedRounds = computed(() => {
    const tournament = this.tournament();
    return tournament ? Object.keys(tournament.rounds ?? {}).length : 0;
  });

  prevRound(): void {
    if (this.hasPrevRound()) this.viewRound.set(this.#firstDisplayed() - 1);
    this.reloadScores();
  }

  nextRound(): void {
    if (this.hasNextRound()) this.viewRound.set(this.#lastDisplayed() + 1);
    this.reloadScores();
  }

  goToCurrent(): void {
    this.viewRound.set(null);
    this.reloadScores();
  }

  private reloadScores(): void {
    const tournament = this.tournament();
    if (tournament) this.syncScores(tournament);
  }

  // ── Current round data ────────────────────────────────────────────────────

  readonly currentRound = computed<TournamentRound | null>(() => {
    const tournament = this.tournament();
    if (!tournament) return null;
    return tournament.rounds?.[this.displayRound()] ?? null;
  });

  readonly currentMatches = computed<Array<TournamentMatch>>(() => {
    const round = this.currentRound();
    if (!round?.matches) return [];
    return Object.values(round.matches).sort(
      (a, b) => a.courtIndex - b.courtIndex,
    );
  });

  readonly sitOuts = computed<Array<string>>(() => {
    const round = this.currentRound();
    if (!round?.sitOutIds) return [];
    return Object.values(round.sitOutIds);
  });

  /** Every match across the displayed round(s). */
  readonly #displayedMatches = computed<Array<TournamentMatch>>(() => {
    const tournament = this.tournament();
    if (!tournament) return [];
    return this.displayedRounds().flatMap((index) =>
      Object.values(tournament.rounds?.[index]?.matches ?? {}),
    );
  });

  /** Beat-the-box block matches grouped by court (empty outside a block). */
  readonly boxCourts = computed<Array<BoxCourt>>(() => {
    const tournament = this.tournament();
    if (!tournament || !this.isBoxBlock()) return [];
    const courts = new Map<number, BoxCourt>();
    for (const roundIndex of this.displayedRounds()) {
      const matches = Object.values(tournament.rounds?.[roundIndex]?.matches ?? {});
      for (const match of matches) {
        let court = courts.get(match.courtIndex);
        if (!court) {
          court = {
            courtIndex: match.courtIndex,
            playerIds: [match.a1, match.a2, match.b1, match.b2],
            entries: [],
          };
          courts.set(match.courtIndex, court);
        }
        court.entries.push({ roundIndex, match });
      }
    }
    return [...courts.values()].sort((a, b) => a.courtIndex - b.courtIndex);
  });

  boxScoredCount(court: BoxCourt): number {
    return court.entries.filter((entry) => {
      const s = this.getScore(entry.match.id);
      return s.score1 !== null && s.score2 !== null;
    }).length;
  }

  /**
   * Admins (and test mode) may edit any score. In a beat-the-box block anyone
   * may enter a result that hasn't been saved yet.
   */
  canEditMatch(match: TournamentMatch, roundIndex: number): boolean {
    if (this.isFinished()) return false;
    if (this.admin.isAdmin() || this.testMode()) return true;
    if (!this.isBoxBlock()) return false;
    if (this.tournament()?.rounds?.[roundIndex]?.completed) return false;
    return match.score1 == null && match.score2 == null;
  }

  canEditCourt(court: BoxCourt): boolean {
    return court.entries.some((e) => this.canEditMatch(e.match, e.roundIndex));
  }

  /** Editable entries with a complete local score that differs from the saved one. */
  private pendingEntries(court: BoxCourt): Array<BoxCourtEntry> {
    return court.entries.filter(({ match, roundIndex }) => {
      if (!this.canEditMatch(match, roundIndex)) return false;
      const s = this.getScore(match.id);
      if (s.score1 === null || s.score2 === null) return false;
      return s.score1 !== (match.score1 ?? null) || s.score2 !== (match.score2 ?? null);
    });
  }

  canSaveCourt(court: BoxCourt): boolean {
    const pending = this.pendingEntries(court);
    return (
      pending.length > 0 &&
      pending.every((e) => !this.scoreError(e.match.id, e.roundIndex))
    );
  }

  async saveCourt(court: BoxCourt): Promise<void> {
    if (!this.canSaveCourt(court)) return;
    const courtScores: Array<CourtScore> = [];
    for (const { match, roundIndex } of this.pendingEntries(court)) {
      const s = this.getScore(match.id);
      if (s.score1 === null || s.score2 === null) continue;
      courtScores.push({
        roundIndex,
        matchId: match.id,
        score1: s.score1,
        score2: s.score2,
      });
    }
    this.error.set("");
    if (this.testMode()) {
      for (const s of courtScores) this.applySandboxScore(s.matchId, s.roundIndex);
      return;
    }
    this.savingCourt.set(court.courtIndex);
    try {
      await this.#service.saveCourtScores(
        this.tournamentId(),
        courtScores,
        this.admin.isAdmin(),
      );
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.saveError"),
      );
    } finally {
      this.savingCourt.set(null);
    }
  }

  /** Box courts are saved explicitly per court; other views save on change. */
  onScoreChange(matchId: string, roundIndex: number): void {
    if (!this.isBoxBlock()) void this.saveScore(matchId, roundIndex);
  }

  courtName(index: number): string {
    return (
      this.tournament()?.courtNames?.[String(index)] ??
      this.i18n.t("court.default", { n: index + 1 })
    );
  }

  /** A blowout where the winner scored at least 5× the loser's points. */
  isMurder(match: TournamentMatch): boolean {
    const s1 = match.score1;
    const s2 = match.score2;
    if (s1 == null || s2 == null || s1 === s2) return false;
    const hi = Math.max(s1, s2);
    const lo = Math.min(s1, s2);
    return lo === 0 ? hi >= 5 : hi >= lo * 5;
  }

  /** The losing side of a murder ('a' | 'b'), or null when not a murder. */
  murderLoser(match: TournamentMatch): "a" | "b" | null {
    if (!this.isMurder(match)) return null;
    return (match.score1 ?? 0) < (match.score2 ?? 0) ? "a" : "b";
  }

  // ── Standings ─────────────────────────────────────────────────────────────

  readonly standings = computed<Array<StandingRow>>(() => {
    const tournament = this.tournament();
    if (!tournament) return [];
    const rows = computeStandings(tournament, (id) => this.participantName(id));
    if (rows.some((row) => row.played > 0)) return rows;
    // Before any games, order by expected placement (highest entry rating first).
    const ratings = this.entryRatingsOf(tournament, rows);
    if (!ratings) return rows;
    return rows
      .map((row, i) => ({ row, rating: ratings[i] ?? 1000 }))
      .sort((a, b) => b.rating - a.rating)
      .map(({ row }) => row);
  });

  readonly #entryRatings = computed<Array<number> | null>(() => {
    const tournament = this.tournament();
    return tournament ? this.entryRatingsOf(tournament, this.standings()) : null;
  });

  /**
   * Rating each row entered the tournament with: stored at award time, unknown
   * for legacy awards (null), otherwise the players' current ratings.
   */
  private entryRatingsOf(
    tournament: Tournament,
    standings: ReadonlyArray<StandingRow>,
  ): Array<number> | null {
    const stored = tournament.ratingsBefore;
    if (stored) return standings.map((row) => stored[row.participantId] ?? 1000);
    if (tournament.ratingsAwarded) return null;
    const ratingById = new Map(this.players().map((p) => [p.id, p.rating]));
    return standingRatings(tournament, standings, (id) => ratingById.get(id) ?? 1000);
  }

  /**
   * Elo change per standings row: the stored deltas once awarded, the legacy
   * linear step for tournaments awarded before pairwise Elo, otherwise a
   * projection from current ratings (test mode: "if it ended now").
   */
  readonly #eloDeltas = computed<Array<number>>(() => {
    const tournament = this.tournament();
    const standings = this.standings();
    if (!tournament || standings.length < 2) return standings.map(() => 0);

    const stored = tournament.ratingDeltas;
    if (stored) return standings.map((row) => stored[row.participantId] ?? 0);

    const ratings = this.#entryRatings();
    if (ratings) return placementEloDeltas(ratings, ELO_K);

    const n = standings.length;
    const step = 2 * PLACEMENT_RATING_PER_PLAYER;
    return standings.map((_, i) => Math.round(((n - 1) / 2 - i) * step));
  });

  placementDelta(index: number): number {
    return this.#eloDeltas()[index] ?? 0;
  }

  readonly showElo = computed(() => this.isFinished() || this.testMode());

  readonly #expectedPlaces = computed<Array<string> | null>(() => {
    const ratings = this.#entryRatings();
    if (!ratings) return null;
    return expectedPlacements(ratings).map(({ from, to }) =>
      from === to ? `${from}` : `${from}–${to}`,
    );
  });

  readonly #breakEvenPlaces = computed<Array<number> | null>(() => {
    const ratings = this.#entryRatings();
    return ratings ? breakEvenPlacements(ratings) : null;
  });

  readonly showExpected = computed(
    () => this.standings().length > 1 && this.#expectedPlaces() !== null,
  );

  expectedPlace(index: number): string {
    return this.#expectedPlaces()?.[index] ?? "";
  }

  breakEvenPlace(index: number): number | null {
    return this.#breakEvenPlaces()?.[index] ?? null;
  }

  readonly kothStats = computed<Record<string, KothStats>>(() => {
    const tournament = this.tournament();
    if (!tournament || !this.isKoth()) return {};
    return computeKothStats(tournament);
  });

  /** KotH stats rows sorted for display (best court, then wins). */
  readonly kothRows = computed(() => {
    const stats = this.kothStats();
    return Object.entries(stats)
      .map(([id, s]) => ({ id, name: this.participantName(id), s }))
      .sort(
        (a, b) =>
          a.s.highestCourt - b.s.highestCourt ||
          b.s.kingWins - a.s.kingWins ||
          b.s.wins - a.s.wins,
      );
  });

  readonly ladder = computed<Array<LadderCourt>>(() => {
    if (!this.isKoth()) return [];
    return this.currentMatches().map((m) => ({
      courtIndex: m.courtIndex,
      courtName: this.courtName(m.courtIndex),
      isKing: m.courtIndex === 0,
      match: m,
    }));
  });

  // ── Winner ──────────────────────────────────────────────────────────────

  readonly winnerLabel = computed<string>(() => {
    const tournament = this.tournament();
    if (!tournament || !this.isFinished()) return "";
    if (this.isKoth()) {
      const rounds = Object.values(tournament.rounds ?? {}).sort(
        (a, b) => b.index - a.index,
      );
      const finalRound = rounds.find((r) => r.completed);
      const kingMatch = Object.values(finalRound?.matches ?? {}).find(
        (m) => m.courtIndex === 0,
      );
      if (!kingMatch) return "";
      const aWon = (kingMatch.score1 ?? 0) > (kingMatch.score2 ?? 0);
      const winners = aWon
        ? [kingMatch.a1, kingMatch.a2]
        : [kingMatch.b1, kingMatch.b2];
      return winners.map((id) => this.playerName(id)).join(" & ");
    }
    return this.standings()[0]?.name ?? "";
  });

  // ── Names / images ────────────────────────────────────────────────────────

  playerName(id: string): string {
    const p = this.players().find((p) => p.id === id);
    if (!p) return id.slice(0, 6);
    const first = p.name.trim().split(/\s+/)[0];
    return p.shortname ? `${first} (${p.shortname})` : p.name;
  }

  playerImage(id: string): string | undefined {
    return this.players().find((p) => p.id === id)?.shortname;
  }

  participantName(id: string): string {
    const tournament = this.tournament();
    const team = Object.values(tournament?.teams ?? {}).find(
      (x) => x.id === id,
    );
    if (team) return team.name;
    return this.playerName(id);
  }

  teamName(teamId?: string): string {
    if (!teamId) return "";
    const tournament = this.tournament();
    return (
      Object.values(tournament?.teams ?? {}).find((x) => x.id === teamId)
        ?.name ?? ""
    );
  }

  kothMovementIcon(id: string): string {
    const s = this.kothStats()[id];
    if (!s) return "";
    switch (s.lastMovement) {
      case "up":
        return "↑";
      case "down":
        return "↓";
      case "stay-top":
        return "↑";
      case "stay-bottom":
        return "↓";
      default:
        return "•";
    }
  }

  // ── Test mode (in-memory dry run) ───────────────────────────────────────

  /** True when the current tournament can be tried without starting/affecting it. */
  readonly canTest = computed(() => {
    const t = this.#liveTournament();
    return !!t && (t.status === "active" || t.status === "draft");
  });

  /** Enter a sandbox dry run: clone the tournament and play it in memory only. */
  enterTestMode(): void {
    const src = this.#liveTournament();
    if (!src) return;
    let sandbox = structuredClone(src) as Tournament;
    // A draft has no rounds yet — generate the opening schedule so it's playable.
    if (sandbox.status === "draft") {
      const { rounds, totalRounds } = generateInitialRounds(sandbox);
      sandbox = {
        ...sandbox,
        rounds,
        totalRounds,
        status: "active",
        currentRound: 0,
      };
    }
    this.#sandbox.set(sandbox);
    this.testMode.set(true);
    this.viewRound.set(null);
    this.scores.set({});
    this.error.set("");
    this.reloadScores();
  }

  /** Leave the sandbox and return to the live tournament. */
  exitTestMode(): void {
    this.testMode.set(false);
    this.#sandbox.set(null);
    this.viewRound.set(null);
    this.scores.set({});
    this.error.set("");
    this.reloadScores();
  }

  private updateSandbox(fn: (t: Tournament) => Tournament): void {
    const s = this.#sandbox();
    if (s) this.#sandbox.set(fn(s));
  }

  /** Write the currently entered score for a match into the sandbox round. */
  private applySandboxScore(matchId: string, roundIndex: number): void {
    const s = this.getScore(matchId);
    this.updateSandbox((t) => {
      const round = t.rounds?.[roundIndex];
      const match = round?.matches?.[matchId];
      if (!round || !match) return t;
      return {
        ...t,
        rounds: {
          ...t.rounds,
          [roundIndex]: {
            ...round,
            matches: {
              ...round.matches,
              [matchId]: {
                ...match,
                score1: s.score1 ?? undefined,
                score2: s.score2 ?? undefined,
              },
            },
          },
        },
      };
    });
  }

  // ── Score entry ───────────────────────────────────────────────────────────

  getScore(matchId: string): MatchScore {
    return this.scores()[matchId] ?? { score1: null, score2: null };
  }

  setScore(matchId: string, field: "score1" | "score2", value: string): void {
    const parsedScore = value === "" ? null : Number(value);
    const current = this.getScore(matchId);
    const next = { ...current, [field]: parsedScore };

    // Fixed-points: the two scores must sum to the target, so prefill the other.
    const scoring = this.tournament()?.scoring;
    if (
      scoring?.method === "fixed-points" &&
      scoring.pointTarget != null &&
      parsedScore !== null &&
      parsedScore >= 0 &&
      parsedScore <= scoring.pointTarget
    ) {
      const other = field === "score1" ? "score2" : "score1";
      next[other] = scoring.pointTarget - parsedScore;
    }

    this.scores.set({
      ...this.scores(),
      [matchId]: next,
    });
  }

  /**
   * Uncompleted displayed rounds, from the current one onwards, that can be
   * completed in order because all their scores are entered.
   */
  readonly #completableRounds = computed<Array<number>>(() => {
    const tournament = this.tournament();
    if (!tournament) return [];
    const result: Array<number> = [];
    for (const index of this.displayedRounds()) {
      if (index < tournament.currentRound) continue;
      const matches = Object.values(tournament.rounds?.[index]?.matches ?? {});
      const entered =
        matches.length > 0 &&
        matches.every((m) => {
          const s = this.scores()[m.id];
          return s !== undefined && s.score1 !== null && s.score2 !== null;
        });
      if (!entered) break;
      result.push(index);
    }
    return result;
  });

  readonly canComplete = computed(() => this.#completableRounds().length > 0);

  /** Warn if editing a completed round that later rounds were based on. */
  readonly editWarning = computed(() => {
    const tournament = this.tournament();
    if (!tournament || !this.isDynamic()) return "";
    const round = this.currentRound();
    if (round?.completed && this.#lastDisplayed() < tournament.currentRound) {
      return this.i18n.t("view.editWarn");
    }
    return "";
  });

  scoreError(matchId: string, roundIndex: number = this.displayRound()): string {
    const tournament = this.tournament();
    if (!tournament) return "";
    const s = this.getScore(matchId);
    if (s.score1 === null || s.score2 === null) return "";
    const v = validateScore(
      s.score1,
      s.score2,
      tournament.scoring,
      phaseFormatFor(tournament, roundIndex),
    );
    return v.valid
      ? ""
      : this.i18n.t(v.reason ?? "err.invalidScore", v.reasonParams);
  }

  async saveScore(
    matchId: string,
    roundIndex: number = this.displayRound(),
  ): Promise<void> {
    if (!this.admin.isAdmin() && !this.testMode()) return;
    const s = this.getScore(matchId);
    if (s.score1 === null || s.score2 === null) return;
    const tournament = this.tournament();
    if (tournament) {
      const v = validateScore(
        s.score1,
        s.score2,
        tournament.scoring,
        phaseFormatFor(tournament, roundIndex),
      );
      if (!v.valid) {
        this.error.set(
          this.i18n.t(v.reason ?? "err.invalidScore", v.reasonParams),
        );
        return;
      }
    }
    this.error.set("");
    if (this.testMode()) {
      this.applySandboxScore(matchId, roundIndex);
      return;
    }
    try {
      await this.#service.saveMatchScore(
        this.tournamentId(),
        roundIndex,
        matchId,
        s.score1,
        s.score2,
      );
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.saveError"),
      );
    }
  }

  async resetScore(
    matchId: string,
    roundIndex: number = this.displayRound(),
  ): Promise<void> {
    if (!this.admin.isAdmin() && !this.testMode()) return;
    this.scores.set({
      ...this.scores(),
      [matchId]: { score1: null, score2: null },
    });
    if (this.testMode()) {
      this.applySandboxScore(matchId, roundIndex);
      return;
    }
    try {
      await this.#service.resetMatchScore(
        this.tournamentId(),
        roundIndex,
        matchId,
      );
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.error"),
      );
    }
  }

  // ── Round actions ───────────────────────────────────────────────────────

  async completeRound(): Promise<void> {
    if (!this.admin.isAdmin() && !this.testMode()) return;
    const roundIndices = this.#completableRounds();
    if (roundIndices.length === 0) return;
    const matchesOf = (index: number): Array<TournamentMatch> =>
      Object.values(this.tournament()?.rounds?.[index]?.matches ?? {});
    this.completing.set(true);
    this.error.set("");
    if (this.testMode()) {
      try {
        for (const index of roundIndices) {
          for (const match of matchesOf(index))
            this.applySandboxScore(match.id, index);
          this.updateSandbox((t) => completeCurrentRound(t));
        }
        this.scores.set({});
        this.viewRound.set(null);
        this.reloadScores();
      } catch (error) {
        this.error.set(
          error instanceof Error
            ? this.i18n.t(error.message)
            : this.i18n.t("common.error"),
        );
      } finally {
        this.completing.set(false);
      }
      return;
    }
    try {
      for (const index of roundIndices) {
        for (const match of matchesOf(index)) {
          await this.saveScore(match.id, index);
        }
        await this.#service.completeRound(this.tournamentId());
      }
      this.scores.set({});
      this.viewRound.set(null);
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.error"),
      );
    } finally {
      this.completing.set(false);
    }
  }

  readonly currentRoundHasScores = computed(() =>
    this.#displayedMatches().some((m) => {
      const s = this.scores()[m.id];
      return (s?.score1 ?? null) !== null || (s?.score2 ?? null) !== null;
    }),
  );

  readonly canRegenerate = computed(() => {
    const tournament = this.tournament();
    if (!tournament || !this.isDynamic() || !this.isCurrentRound())
      return false;
    const round = this.currentRound();
    if (round?.completed) return false;
    return !this.currentRoundHasScores();
  });

  async regenerate(): Promise<void> {
    if (!this.admin.isAdmin() && !this.testMode()) return;
    if (!this.canRegenerate()) return;
    this.regenerating.set(true);
    this.error.set("");
    if (this.testMode()) {
      try {
        this.updateSandbox((t) => regenerateCurrentRound(t));
        this.scores.set({});
        this.reloadScores();
      } catch (error) {
        this.error.set(
          error instanceof Error
            ? this.i18n.t(error.message)
            : this.i18n.t("common.error"),
        );
      } finally {
        this.regenerating.set(false);
      }
      return;
    }
    try {
      await this.#service.regenerateCurrentRound(this.tournamentId());
      this.scores.set({});
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.error"),
      );
    } finally {
      this.regenerating.set(false);
    }
  }

  /** True once a final round has been generated (persisted on any round). */
  readonly finalRoundGenerated = computed(() => {
    const tournament = this.tournament();
    if (!tournament) return false;
    return Object.values(tournament.rounds ?? {}).some((r) => r.isFinal);
  });

  /** True when the round currently displayed is the final round. */
  readonly isFinalRound = computed(() => !!this.currentRound()?.isFinal);

  readonly canRunFinal = computed(() => {
    const tournament = this.tournament();
    if (!tournament || !this.isMexericano() || !this.isActive()) return false;
    if (this.finalRoundGenerated()) return false;
    // At least one completed round required.
    const completed = Object.values(tournament.rounds ?? {}).filter(
      (r) => r.completed,
    ).length;
    if (completed < 1) return false;
    // Enough players and a live, unscored current round.
    if (this.currentMatches().length < 1) return false;
    const round = tournament.rounds?.[tournament.currentRound];
    return !round?.completed;
  });

  async runFinalRound(): Promise<void> {
    if ((!this.admin.isAdmin() && !this.testMode()) || !this.canRunFinal())
      return;
    if (this.currentRoundHasScores()) return;
    if (
      !(await this.#confirm.ask({
        message: this.i18n.t(
          this.testMode() ? "view.finalConfirmTest" : "view.finalConfirm",
        ),
      }))
    )
      return;
    this.runningFinal.set(true);
    this.error.set("");
    if (this.testMode()) {
      try {
        this.updateSandbox((t) => runFinalRound(t));
        this.scores.set({});
        this.viewRound.set(null);
        this.reloadScores();
      } catch (error) {
        this.error.set(
          error instanceof Error
            ? this.i18n.t(error.message)
            : this.i18n.t("common.error"),
        );
      } finally {
        this.runningFinal.set(false);
      }
      return;
    }
    try {
      await this.#service.runFinalRound(this.tournamentId());
      this.scores.set({});
      this.viewRound.set(null);
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.error"),
      );
    } finally {
      this.runningFinal.set(false);
    }
  }

  async finishEarly(): Promise<void> {
    if (!this.admin.isAdmin() && !this.testMode()) return;
    if (
      !(await this.#confirm.ask({
        message: this.i18n.t(
          this.testMode() ? "view.finishConfirmTest" : "view.finishConfirm",
        ),
      }))
    )
      return;
    this.finishing.set(true);
    if (this.testMode()) {
      this.updateSandbox((t) => ({
        ...t,
        status: "finished",
        currentRound: this.displayRound(),
      }));
      this.finishing.set(false);
      return;
    }
    try {
      await this.#service.finishTournament(this.tournamentId());
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.error"),
      );
    } finally {
      this.finishing.set(false);
    }
  }

  async startDraft(): Promise<void> {
    if (!this.admin.isAdmin()) return;
    this.completing.set(true);
    this.error.set("");
    try {
      await this.#service.startTournament(this.tournamentId());
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.error"),
      );
    } finally {
      this.completing.set(false);
    }
  }

  editDraft(): void {
    if (!this.admin.isAdmin()) return;
    this.#router.navigate(["/tournament/new"], {
      queryParams: { draft: this.tournamentId() },
    });
  }

  async deleteTournament(): Promise<void> {
    const tournament = this.tournament();
    if (!this.admin.isAdmin() || !tournament) return;
    if (
      !(await this.#confirm.ask({
        message: this.i18n.t("view.deleteConfirm", { name: tournament.name }),
        danger: true,
      }))
    )
      return;
    this.deleting.set(true);
    try {
      await this.#service.deleteTournament(tournament.id);
      this.#router.navigate(["/"]);
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? this.i18n.t(error.message)
          : this.i18n.t("common.error"),
      );
      this.deleting.set(false);
    }
  }
}
