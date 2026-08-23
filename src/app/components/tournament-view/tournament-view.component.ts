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
import type {
  Player,
  Tournament,
  TournamentMatch,
  TournamentRound,
} from '../../models/padel.model';
import { CommonModule } from '@angular/common';

interface MatchScore {
  score1: number | null;
  score2: number | null;
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

  readonly tournament = signal<Tournament | null>(null);
  readonly players = signal<Player[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly completing = signal(false);
  readonly finishing = signal(false);

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

  /** Pre-populate local scores from already-saved values in the DB. */
  private syncScores(t: Tournament): void {
    const round = t.rounds?.[t.currentRound];
    if (!round?.matches) return;
    const current = this.scores();
    const next = { ...current };
    for (const match of Object.values(round.matches)) {
      if (!next[match.id]) {
        next[match.id] = {
          score1: match.score1 ?? null,
          score2: match.score2 ?? null,
        };
      }
    }
    this.scores.set(next);
  }

  readonly currentRound = computed<TournamentRound | null>(() => {
    const t = this.tournament();
    if (!t) return null;
    return t.rounds?.[t.currentRound] ?? null;
  });

  readonly currentMatches = computed<TournamentMatch[]>(() => {
    const round = this.currentRound();
    if (!round?.matches) return [];
    return Object.values(round.matches);
  });

  readonly pointsLeaderboard = computed(() => {
    const t = this.tournament();
    const ps = this.players();
    if (!t?.pointsTable) return [];
    return Object.entries(t.pointsTable)
      .map(([id, pts]) => ({
        player: ps.find((p) => p.id === id),
        pts: pts as number,
      }))
      .filter((e) => !!e.player)
      .sort((a, b) => b.pts - a.pts);
  });

  readonly allScoresEntered = computed(() => {
    const matches = this.currentMatches();
    if (matches.length === 0) return false;
    return matches.every((m) => {
      const s = this.scores()[m.id];
      return s?.score1 !== null && s?.score2 !== null;
    });
  });

  readonly isAmericano = computed(
    () => this.tournament()?.format === 'americano',
  );

  readonly maxRounds = computed(() => {
    const t = this.tournament();
    if (!t) return 0;
    const n = Object.keys(t.playerIds ?? {}).length;
    return t.format === 'americano' ? n - 1 : 999;
  });

  readonly isLastRound = computed(() => {
    const t = this.tournament();
    if (!t) return false;
    return t.format === 'americano' && t.currentRound >= this.maxRounds() - 1;
  });

  playerName(id: string): string {
    return this.players().find((p) => p.id === id)?.name ?? id.slice(0, 6);
  }

  playerImage(id: string): string | undefined {
    return this.players().find((p) => p.id === id)?.shortname;
  }

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

  async saveScore(matchId: string): Promise<void> {
    const s = this.getScore(matchId);
    if (s.score1 === null || s.score2 === null) return;
    try {
      await this.service.saveMatchScore(
        this.tournamentId(),
        this.tournament()!.currentRound,
        matchId,
        s.score1,
        s.score2,
      );
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Fejl ved gem.');
    }
  }

  async completeRound(): Promise<void> {
    if (!this.allScoresEntered()) return;
    this.completing.set(true);
    this.error.set('');

    // Persist any unsaved local scores first
    for (const match of this.currentMatches()) {
      await this.saveScore(match.id);
    }

    try {
      await this.service.completeRound(this.tournamentId());
      this.scores.set({}); // reset for next round
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Fejl.');
    } finally {
      this.completing.set(false);
    }
  }

  async finishEarly(): Promise<void> {
    if (
      !window.confirm(
        'Afslut turneringen tidligt? Aktuelle resultater bevares.',
      )
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
}
