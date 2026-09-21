import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PadelService } from '../../services/padel.service';
import { AdminService } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { ConfirmService } from '../../services/confirm.service';
import {
  isDynamicFormat,
  isTeamFormat,
  type KothStats,
  type Player,
  type StandingRow,
  type Tournament,
  type TournamentMatch,
  type TournamentRound,
} from '../../models/padel.model';
import {
  completeCurrentRound,
  computeKothStats,
  computeStandings,
  generateInitialRounds,
  regenerateCurrentRound,
  runFinalRound,
  validateScore,
} from '../../services/tournament-engine';
import { CommonModule } from '@angular/common';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

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
  selector: 'app-tournament-view',
  imports: [CommonModule, FormsModule, RouterLink, ImgFallbackDirective],
  templateUrl: './tournament-view.component.html',
  styleUrl: './tournament-view.component.scss',
})
export class TournamentViewComponent implements OnInit {
  readonly tournamentId = input.required<string>();

  private service = inject(PadelService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  readonly admin = inject(AdminService);
  readonly i18n = inject(I18nService);

  /** Live tournament from Firebase. */
  private readonly liveTournament = signal<Tournament | null>(null);
  /** In-memory sandbox copy used while test mode is on (never persisted). */
  private readonly sandbox = signal<Tournament | null>(null);
  /** When true, all play happens on the sandbox copy with no writes. */
  readonly testMode = signal(false);

  /** Effective tournament shown and played (sandbox copy in test mode). */
  readonly tournament = computed<Tournament | null>(() =>
    this.testMode() ? this.sandbox() : this.liveTournament(),
  );

  readonly players = signal<Player[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly completing = signal(false);
  readonly finishing = signal(false);
  readonly regenerating = signal(false);
  readonly runningFinal = signal(false);
  readonly deleting = signal(false);

  /** Round the user is currently viewing (null → follow current round). */
  readonly viewRound = signal<number | null>(null);

  /** Local score state: matchId → { score1, score2 } */
  readonly scores = signal<Record<string, MatchScore>>({});

  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.service
      .watchTournament(this.tournamentId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tournament) => {
          this.liveTournament.set(tournament);
          this.loading.set(false);
          if (!tournament) {
            this.router.navigate(['/']);
            return;
          }
          // While testing, the sandbox drives the view — ignore live updates.
          if (this.testMode()) return;
          // Finished tournaments always open at round 1 (index 0).
          if (tournament.status === 'finished' && this.viewRound() === null) {
            this.viewRound.set(0);
          }
          this.syncScores(tournament);
        },
        error: (error) => {
          this.error.set(error?.message ?? 'Fejl.');
          this.loading.set(false);
        },
      });
    this.service
      .watchPlayers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => this.players.set(list));
  }

  /** Pre-populate local scores from saved values for the displayed round. */
  private syncScores(tournament: Tournament): void {
    const round = tournament.rounds?.[this.displayRoundIndexOf(tournament)];
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

  private displayRoundIndexOf(tournament: Tournament): number {
    const v = this.viewRound();
    return v ?? tournament.currentRound;
  }

  // ── Format flags ──────────────────────────────────────────────────────────

  readonly isTeam = computed(() =>
    this.tournament() ? isTeamFormat(this.tournament()!.format) : false,
  );
  readonly isDynamic = computed(() =>
    this.tournament() ? isDynamicFormat(this.tournament()!.format) : false,
  );
  readonly isKoth = computed(
    () => this.tournament()?.format === 'king-of-the-hill',
  );
  readonly isSuperMex = computed(
    () => this.tournament()?.format === 'super-mexicano',
  );
  readonly isMexericano = computed(
    () => this.tournament()?.format === 'mexericano',
  );
  readonly hasBonus = computed(() => !!this.tournament()?.bonus?.enabled);
  readonly isDraft = computed(() => this.tournament()?.status === 'draft');
  readonly isActive = computed(() => this.tournament()?.status === 'active');
  readonly isFinished = computed(() => this.tournament()?.status === 'finished');

  // ── Round navigation ────────────────────────────────────────────────────

  readonly displayRound = computed(() => {
    const tournament = this.tournament();
    if (!tournament) return 0;
    return this.displayRoundIndexOf(tournament);
  });

  readonly isCurrentRound = computed(() => {
    const tournament = this.tournament();
    return !!tournament && this.displayRound() === tournament.currentRound;
  });

  readonly hasPrevRound = computed(() => this.displayRound() > 0);

  readonly hasNextRound = computed(() => {
    const tournament = this.tournament();
    if (!tournament) return false;
    return (tournament.rounds?.[this.displayRound() + 1] ?? null) !== null;
  });

  readonly totalGeneratedRounds = computed(() => {
    const tournament = this.tournament();
    return tournament ? Object.keys(tournament.rounds ?? {}).length : 0;
  });

  prevRound(): void {
    if (this.hasPrevRound()) this.viewRound.set(this.displayRound() - 1);
    this.reloadScores();
  }

  nextRound(): void {
    if (this.hasNextRound()) this.viewRound.set(this.displayRound() + 1);
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

  readonly currentMatches = computed<TournamentMatch[]>(() => {
    const round = this.currentRound();
    if (!round?.matches) return [];
    return Object.values(round.matches).sort(
      (a, b) => a.courtIndex - b.courtIndex,
    );
  });

  readonly sitOuts = computed<string[]>(() => {
    const round = this.currentRound();
    if (!round?.sitOutIds) return [];
    return Object.values(round.sitOutIds);
  });

  courtName(index: number): string {
    return this.tournament()?.courtNames?.[String(index)] ?? this.i18n.t('court.default', { n: index + 1 });
  }

  // ── Standings ─────────────────────────────────────────────────────────────

  readonly standings = computed<StandingRow[]>(() => {
    const tournament = this.tournament();
    if (!tournament) return [];
    return computeStandings(tournament, (id) => this.participantName(id));
  });

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

  readonly ladder = computed<LadderCourt[]>(() => {
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
    if (!tournament || !this.isFinished()) return '';
    if (this.isKoth()) {
      const rounds = Object.values(tournament.rounds ?? {}).sort(
        (a, b) => b.index - a.index,
      );
      const finalRound = rounds.find((r) => r.completed);
      const kingMatch = Object.values(finalRound?.matches ?? {}).find(
        (m) => m.courtIndex === 0,
      );
      if (!kingMatch) return '';
      const aWon = (kingMatch.score1 ?? 0) > (kingMatch.score2 ?? 0);
      const winners = aWon
        ? [kingMatch.a1, kingMatch.a2]
        : [kingMatch.b1, kingMatch.b2];
      return winners.map((id) => this.playerName(id)).join(' & ');
    }
    return this.standings()[0]?.name ?? '';
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
    const team = Object.values(tournament?.teams ?? {}).find((x) => x.id === id);
    if (team) return team.name;
    return this.playerName(id);
  }

  teamName(teamId?: string): string {
    if (!teamId) return '';
    const tournament = this.tournament();
    return Object.values(tournament?.teams ?? {}).find((x) => x.id === teamId)?.name ?? '';
  }

  kothMovementIcon(id: string): string {
    const s = this.kothStats()[id];
    if (!s) return '';
    switch (s.lastMovement) {
      case 'up': return '↑';
      case 'down': return '↓';
      case 'stay-top': return '↑';
      case 'stay-bottom': return '↓';
      default: return '•';
    }
  }

  // ── Test mode (in-memory dry run) ───────────────────────────────────────

  /** True when the current tournament can be tried without starting/affecting it. */
  readonly canTest = computed(() => {
    const t = this.liveTournament();
    return !!t && (t.status === 'active' || t.status === 'draft');
  });

  /** Enter a sandbox dry run: clone the tournament and play it in memory only. */
  enterTestMode(): void {
    const src = this.liveTournament();
    if (!src) return;
    let sandbox = structuredClone(src) as Tournament;
    // A draft has no rounds yet — generate the opening schedule so it's playable.
    if (sandbox.status === 'draft') {
      const { rounds, totalRounds } = generateInitialRounds(sandbox);
      sandbox = {
        ...sandbox,
        rounds,
        totalRounds,
        status: 'active',
        currentRound: 0,
      };
    }
    this.sandbox.set(sandbox);
    this.testMode.set(true);
    this.viewRound.set(null);
    this.scores.set({});
    this.error.set('');
    this.reloadScores();
  }

  /** Leave the sandbox and return to the live tournament. */
  exitTestMode(): void {
    this.testMode.set(false);
    this.sandbox.set(null);
    this.viewRound.set(null);
    this.scores.set({});
    this.error.set('');
    this.reloadScores();
  }

  private updateSandbox(fn: (t: Tournament) => Tournament): void {
    const s = this.sandbox();
    if (s) this.sandbox.set(fn(s));
  }

  /** Write the currently entered score for a match into the sandbox round. */
  private applySandboxScore(matchId: string): void {
    const s = this.getScore(matchId);
    const roundIndex = this.displayRound();
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

  setScore(matchId: string, field: 'score1' | 'score2', value: string): void {
    const parsedScore = value === '' ? null : Number(value);
    const current = this.getScore(matchId);
    this.scores.set({
      ...this.scores(),
      [matchId]: { ...current, [field]: parsedScore },
    });
  }

  readonly allScoresEntered = computed(() => {
    const matches = this.currentMatches();
    if (matches.length === 0) return false;
    return matches.every((m) => {
      const s = this.scores()[m.id];
      return s?.score1 !== null && s?.score2 !== null && s !== undefined;
    });
  });

  /** Warn if editing a completed round that later rounds were based on. */
  readonly editWarning = computed(() => {
    const tournament = this.tournament();
    if (!tournament || !this.isDynamic()) return '';
    const round = this.currentRound();
    if (round?.completed && this.displayRound() < tournament.currentRound) {
      return this.i18n.t('view.editWarn');
    }
    return '';
  });

  scoreError(matchId: string): string {
    const tournament = this.tournament();
    if (!tournament) return '';
    const s = this.getScore(matchId);
    if (s.score1 === null || s.score2 === null) return '';
    const v = validateScore(s.score1, s.score2, tournament.scoring, tournament.format);
    return v.valid ? '' : this.i18n.t(v.reason ?? 'err.invalidScore', v.reasonParams);
  }

  async saveScore(matchId: string): Promise<void> {
    if (!this.admin.isAdmin() && !this.testMode()) return;
    const s = this.getScore(matchId);
    if (s.score1 === null || s.score2 === null) return;
    const tournament = this.tournament();
    if (tournament) {
      const v = validateScore(s.score1, s.score2, tournament.scoring, tournament.format);
      if (!v.valid) {
        this.error.set(this.i18n.t(v.reason ?? 'err.invalidScore', v.reasonParams));
        return;
      }
    }
    this.error.set('');
    if (this.testMode()) {
      this.applySandboxScore(matchId);
      return;
    }
    try {
      await this.service.saveMatchScore(
        this.tournamentId(),
        this.displayRound(),
        matchId,
        s.score1,
        s.score2,
      );
    } catch (error) {
      this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.saveError'));
    }
  }

  async resetScore(matchId: string): Promise<void> {
    if (!this.admin.isAdmin() && !this.testMode()) return;
    this.scores.set({
      ...this.scores(),
      [matchId]: { score1: null, score2: null },
    });
    if (this.testMode()) {
      this.applySandboxScore(matchId);
      return;
    }
    try {
      await this.service.resetMatchScore(
        this.tournamentId(),
        this.displayRound(),
        matchId,
      );
    } catch (error) {
      this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
    }
  }

  // ── Round actions ───────────────────────────────────────────────────────

  async completeRound(): Promise<void> {
    if (!this.admin.isAdmin() && !this.testMode()) return;
    if (!this.allScoresEntered()) return;
    this.completing.set(true);
    this.error.set('');
    if (this.testMode()) {
      try {
        for (const match of this.currentMatches()) this.applySandboxScore(match.id);
        this.updateSandbox((t) => completeCurrentRound(t));
        this.scores.set({});
        this.viewRound.set(null);
        this.reloadScores();
      } catch (error) {
        this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
      } finally {
        this.completing.set(false);
      }
      return;
    }
    for (const match of this.currentMatches()) {
      await this.saveScore(match.id);
    }
    try {
      await this.service.completeRound(this.tournamentId());
      this.scores.set({});
      this.viewRound.set(null);
    } catch (error) {
      this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
    } finally {
      this.completing.set(false);
    }
  }

  readonly canRegenerate = computed(() => {
    const tournament = this.tournament();
    if (!tournament || !this.isDynamic() || !this.isCurrentRound()) return false;
    const round = this.currentRound();
    if (round?.completed) return false;
    const anyScore = this.currentMatches().some((m) => {
      const s = this.scores()[m.id];
      return (s?.score1 ?? null) !== null || (s?.score2 ?? null) !== null;
    });
    return !anyScore;
  });

  async regenerate(): Promise<void> {
    if (!this.admin.isAdmin() && !this.testMode()) return;
    if (!this.canRegenerate()) return;
    this.regenerating.set(true);
    this.error.set('');
    if (this.testMode()) {
      try {
        this.updateSandbox((t) => regenerateCurrentRound(t));
        this.scores.set({});
        this.reloadScores();
      } catch (error) {
        this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
      } finally {
        this.regenerating.set(false);
      }
      return;
    }
    try {
      await this.service.regenerateCurrentRound(this.tournamentId());
      this.scores.set({});
    } catch (error) {
      this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
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
    if ((!this.admin.isAdmin() && !this.testMode()) || !this.canRunFinal()) return;
    if (
      !(await this.confirm.ask({
        message: this.i18n.t(this.testMode() ? 'view.finalConfirmTest' : 'view.finalConfirm'),
      }))
    )
      return;
    this.runningFinal.set(true);
    this.error.set('');
    if (this.testMode()) {
      try {
        this.updateSandbox((t) => runFinalRound(t));
        this.scores.set({});
        this.viewRound.set(null);
        this.reloadScores();
      } catch (error) {
        this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
      } finally {
        this.runningFinal.set(false);
      }
      return;
    }
    try {
      await this.service.runFinalRound(this.tournamentId());
      this.scores.set({});
      this.viewRound.set(null);
    } catch (error) {
      this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
    } finally {
      this.runningFinal.set(false);
    }
  }

  async finishEarly(): Promise<void> {
    if (!this.admin.isAdmin() && !this.testMode()) return;
    if (
      !(await this.confirm.ask({
        message: this.i18n.t(this.testMode() ? 'view.finishConfirmTest' : 'view.finishConfirm'),
      }))
    )
      return;
    this.finishing.set(true);
    if (this.testMode()) {
      this.updateSandbox((t) => ({ ...t, status: 'finished', currentRound: this.displayRound() }));
      this.finishing.set(false);
      return;
    }
    try {
      await this.service.finishTournament(this.tournamentId());
    } catch (error) {
      this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
    } finally {
      this.finishing.set(false);
    }
  }

  async startDraft(): Promise<void> {
    if (!this.admin.isAdmin()) return;
    this.completing.set(true);
    this.error.set('');
    try {
      await this.service.startTournament(this.tournamentId());
    } catch (error) {
      this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
    } finally {
      this.completing.set(false);
    }
  }

  editDraft(): void {
    if (!this.admin.isAdmin()) return;
    this.router.navigate(['/tournament/new'], {
      queryParams: { draft: this.tournamentId() },
    });
  }

  async deleteTournament(): Promise<void> {
    const tournament = this.tournament();
    if (!this.admin.isAdmin() || !tournament) return;
    if (
      !(await this.confirm.ask({
        message: this.i18n.t('view.deleteConfirm', { name: tournament.name }),
        danger: true,
      }))
    )
      return;
    this.deleting.set(true);
    try {
      await this.service.deleteTournament(tournament.id);
      this.router.navigate(['/']);
    } catch (error) {
      this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
      this.deleting.set(false);
    }
  }
}
