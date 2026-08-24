import {
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PadelService } from '../../services/padel.service';
import {
  FORMAT_LABELS,
  isDynamicFormat,
  isTeamFormat,
  SCORING_LABELS,
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
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tournament-view.component.html',
  styleUrl: './tournament-view.component.scss',
})
export class TournamentViewComponent implements OnInit, OnDestroy {
  readonly tournamentId = input.required<string>();

  private service = inject(PadelService);
  private router = inject(Router);

  readonly FORMAT_LABELS = FORMAT_LABELS;
  readonly SCORING_LABELS = SCORING_LABELS;

  readonly tournament = signal<Tournament | null>(null);
  readonly players = signal<Player[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly completing = signal(false);
  readonly finishing = signal(false);
  readonly regenerating = signal(false);

  /** Round the user is currently viewing (null → follow current round). */
  readonly viewRound = signal<number | null>(null);

  /** Local score state: matchId → { score1, score2 } */
  readonly scores = signal<Record<string, MatchScore>>({});

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.subs.push(
      this.service.watchTournament(this.tournamentId()).subscribe({
        next: (t) => {
          this.tournament.set(t);
          this.loading.set(false);
          if (!t) this.router.navigate(['/']);
          else this.syncScores(t);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Fejl.');
          this.loading.set(false);
        },
      }),
      this.service.watchPlayers().subscribe((list) => this.players.set(list)),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  /** Pre-populate local scores from saved values for the displayed round. */
  private syncScores(t: Tournament): void {
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

  private displayRoundIndexOf(t: Tournament): number {
    const v = this.viewRound();
    return v ?? t.currentRound;
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
    const t = this.tournament();
    if (!t) return 0;
    return this.displayRoundIndexOf(t);
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

  readonly totalGeneratedRounds = computed(() => {
    const t = this.tournament();
    return t ? Object.keys(t.rounds ?? {}).length : 0;
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
    const t = this.tournament();
    if (t) this.syncScores(t);
  }

  // ── Current round data ────────────────────────────────────────────────────

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

  readonly sitOuts = computed<string[]>(() => {
    const round = this.currentRound();
    if (!round?.sitOutIds) return [];
    return Object.values(round.sitOutIds);
  });

  courtName(index: number): string {
    return this.tournament()?.courtNames?.[String(index)] ?? `Bane ${index + 1}`;
  }

  // ── Standings ─────────────────────────────────────────────────────────────

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
    const t = this.tournament();
    if (!t || !this.isFinished()) return '';
    if (this.isKoth()) {
      const rounds = Object.values(t.rounds ?? {}).sort(
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
    const t = this.tournament();
    const team = Object.values(t?.teams ?? {}).find((x) => x.id === id);
    if (team) return team.name;
    return this.playerName(id);
  }

  teamName(teamId?: string): string {
    if (!teamId) return '';
    const t = this.tournament();
    return Object.values(t?.teams ?? {}).find((x) => x.id === teamId)?.name ?? '';
  }

  kothMovementIcon(id: string): string {
    const s = this.kothStats()[id];
    if (!s) return '';
    switch (s.lastMovement) {
      case 'up': return '⬆️';
      case 'down': return '⬇️';
      case 'stay-top': return '👑';
      case 'stay-bottom': return '⬇️';
      default: return '•';
    }
  }

  // ── Score entry ───────────────────────────────────────────────────────────

  getScore(matchId: string): MatchScore {
    return this.scores()[matchId] ?? { score1: null, score2: null };
  }

  setScore(matchId: string, field: 'score1' | 'score2', value: string): void {
    const num = value === '' ? null : Math.max(0, Math.min(99, Number(value)));
    const current = this.getScore(matchId);
    this.scores.set({
      ...this.scores(),
      [matchId]: { ...current, [field]: num },
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
    const t = this.tournament();
    if (!t || !this.isDynamic()) return '';
    const round = this.currentRound();
    if (round?.completed && this.displayRound() < t.currentRound) {
      return 'Redigering af en tidligere runde opdaterer stillingen, men senere runder blev genereret ud fra det gamle resultat.';
    }
    return '';
  });

  scoreError(matchId: string): string {
    const t = this.tournament();
    if (!t) return '';
    const s = this.getScore(matchId);
    if (s.score1 === null || s.score2 === null) return '';
    const v = validateScore(s.score1, s.score2, t.scoring, t.format);
    return v.valid ? '' : v.reason ?? '';
  }

  async saveScore(matchId: string): Promise<void> {
    const s = this.getScore(matchId);
    if (s.score1 === null || s.score2 === null) return;
    const t = this.tournament();
    if (t) {
      const v = validateScore(s.score1, s.score2, t.scoring, t.format);
      if (!v.valid) {
        this.error.set(v.reason ?? 'Ugyldigt resultat.');
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
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Fejl ved gem.');
    }
  }

  async resetScore(matchId: string): Promise<void> {
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
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Fejl.');
    }
  }

  // ── Round actions ───────────────────────────────────────────────────────

  async completeRound(): Promise<void> {
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
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Fejl.');
    } finally {
      this.completing.set(false);
    }
  }

  readonly canRegenerate = computed(() => {
    const t = this.tournament();
    if (!t || !this.isDynamic() || !this.isCurrentRound()) return false;
    const round = this.currentRound();
    if (round?.completed) return false;
    const anyScore = this.currentMatches().some((m) => {
      const s = this.scores()[m.id];
      return (s?.score1 ?? null) !== null || (s?.score2 ?? null) !== null;
    });
    return !anyScore;
  });

  async regenerate(): Promise<void> {
    if (!this.canRegenerate()) return;
    this.regenerating.set(true);
    this.error.set('');
    try {
      await this.service.regenerateCurrentRound(this.tournamentId());
      this.scores.set({});
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Fejl.');
    } finally {
      this.regenerating.set(false);
    }
  }

  async finishEarly(): Promise<void> {
    if (
      !window.confirm('Afslut turneringen? Aktuelle resultater bevares.')
    )
      return;
    this.finishing.set(true);
    try {
      await this.service.finishTournament(this.tournamentId());
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Fejl.');
    } finally {
      this.finishing.set(false);
    }
  }

  async startDraft(): Promise<void> {
    this.completing.set(true);
    this.error.set('');
    try {
      await this.service.startTournament(this.tournamentId());
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Fejl.');
    } finally {
      this.completing.set(false);
    }
  }

  editDraft(): void {
    this.router.navigate(['/tournament/new'], {
      queryParams: { draft: this.tournamentId() },
    });
  }
}
