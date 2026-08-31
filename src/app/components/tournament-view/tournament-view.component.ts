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
  computeKothStats,
  computeStandings,
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
  readonly admin = inject(AdminService);
  readonly i18n = inject(I18nService);

  readonly tournament = signal<Tournament | null>(null);
  readonly players = signal<Player[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly completing = signal(false);
  readonly finishing = signal(false);
  readonly regenerating = signal(false);
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
          this.tournament.set(tournament);
          this.loading.set(false);
          if (!tournament) this.router.navigate(['/']);
          else {
            // Finished tournaments always open at round 1 (index 0).
            if (tournament.status === 'finished' && this.viewRound() === null) {
              this.viewRound.set(0);
            }
            this.syncScores(tournament);
          }
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
    return this.players().find((p) => p.id === id)?.name ?? id.slice(0, 6);
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

  // ── Score entry ───────────────────────────────────────────────────────────

  getScore(matchId: string): MatchScore {
    return this.scores()[matchId] ?? { score1: null, score2: null };
  }

  setScore(matchId: string, field: 'score1' | 'score2', value: string): void {
    const parsedScore = value === '' ? null : Math.max(0, Math.min(99, Number(value)));
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
    if (!this.admin.isAdmin()) return;
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
    if (!this.admin.isAdmin()) return;
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
    } catch (error) {
      this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
    }
  }

  // ── Round actions ───────────────────────────────────────────────────────

  async completeRound(): Promise<void> {
    if (!this.admin.isAdmin()) return;
    if (!this.allScoresEntered()) return;
    this.completing.set(true);
    this.error.set('');
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
    if (!this.admin.isAdmin()) return;
    if (!this.canRegenerate()) return;
    this.regenerating.set(true);
    this.error.set('');
    try {
      await this.service.regenerateCurrentRound(this.tournamentId());
      this.scores.set({});
    } catch (error) {
      this.error.set(error instanceof Error ? this.i18n.t(error.message) : this.i18n.t('common.error'));
    } finally {
      this.regenerating.set(false);
    }
  }

  async finishEarly(): Promise<void> {
    if (!this.admin.isAdmin()) return;
    if (
      !window.confirm(this.i18n.t('view.finishConfirm'))
    )
      return;
    this.finishing.set(true);
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
    if (!window.confirm(this.i18n.t('view.deleteConfirm', { name: tournament.name }))) return;
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
