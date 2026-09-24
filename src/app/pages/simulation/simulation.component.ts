import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { RAIL_PHOTOS } from '../../generated/rail-photos';
import { PadelService } from '../../services/padel.service';
import { I18nService } from '../../services/i18n.service';
import { ThemeService } from '../../services/theme.service';
import {
  estimateMatchScore,
  playerMatchStrength,
  SIM_TOTAL_POINTS,
  type Player,
  type Tournament,
} from '../../models/padel.model';

/** A completed match from a past tournament between the two selected teams. */
export interface PreviousMatchup {
  tournamentId: string;
  tournamentName: string;
  createdAt: number;
  /** Score of the currently selected Team A / Team B in that match. */
  teamAScore: number;
  teamBScore: number;
}

@Component({
  selector: 'app-simulation',
  imports: [CommonModule, RouterLink, ImgFallbackDirective],
  templateUrl: './simulation.component.html',
  styleUrl: './simulation.component.scss',
})
export class SimulationComponent implements OnInit {
  private service = inject(PadelService);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);

  readonly players = signal<Player[]>([]);
  readonly tournaments = signal<Tournament[]>([]);
  readonly loading = signal(true);

  readonly a1 = signal<string>('');
  readonly a2 = signal<string>('');
  readonly b1 = signal<string>('');
  readonly b2 = signal<string>('');

  readonly sortedPlayers = computed(() =>
    [...this.players()].sort((a, b) => a.name.localeCompare(b.name, 'da')),
  );

  /** Shuffled once so the two rails never share an image. */
  private readonly shuffledNames = computed(() => this.shuffle([...RAIL_PHOTOS]));

  readonly leftImages = computed(() => {
    const all = this.shuffledNames();
    return all.slice(0, Math.ceil(all.length / 2)).map((name) => this.theme.railImage(name));
  });
  readonly rightImages = computed(() => {
    const all = this.shuffledNames();
    return all.slice(Math.ceil(all.length / 2)).map((name) => this.theme.railImage(name));
  });

  private shuffle(list: string[]): string[] {
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  ngOnInit(): void {
    this.service
      .watchPlayers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.players.set(list);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

    this.service
      .watchTournaments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => this.tournaments.set(list),
      });
  }

  private byId(id: string): Player | undefined {
    return this.players().find((p) => p.id === id);
  }

  /** True if a player is already chosen in a slot other than `own`. */
  isTaken(id: string, own: 'a1' | 'a2' | 'b1' | 'b2'): boolean {
    const slots: Record<string, string> = {
      a1: this.a1(),
      a2: this.a2(),
      b1: this.b1(),
      b2: this.b2(),
    };
    return Object.entries(slots).some(([slot, value]) => slot !== own && value === id);
  }

  readonly teamA = computed(() =>
    [this.a1(), this.a2()].map((id) => this.byId(id)).filter((p): p is Player => !!p),
  );
  readonly teamB = computed(() =>
    [this.b1(), this.b2()].map((id) => this.byId(id)).filter((p): p is Player => !!p),
  );

  readonly ready = computed(() => this.teamA().length === 2 && this.teamB().length === 2);

  readonly result = computed(() => {
    if (!this.ready()) return null;
    return estimateMatchScore(
      this.teamA().map((p) => p.skillset),
      this.teamB().map((p) => p.skillset),
      SIM_TOTAL_POINTS,
    );
  });

  strengthOf(player: Player): number {
    return Math.round(playerMatchStrength(player.skillset) * 10) / 10;
  }

  /** True if two id pairs contain the same two players (order-independent). */
  private samePair(p: [string, string], q: [string, string]): boolean {
    return (p[0] === q[0] && p[1] === q[1]) || (p[0] === q[1] && p[1] === q[0]);
  }

  /**
   * Completed matches from past tournaments where the two currently selected
   * teams faced each other, most recent tournament first.
   */
  readonly previousMatchups = computed<PreviousMatchup[]>(() => {
    if (!this.ready()) return [];

    const selA: [string, string] = [this.a1(), this.a2()];
    const selB: [string, string] = [this.b1(), this.b2()];
    const found: PreviousMatchup[] = [];

    for (const t of this.tournaments()) {
      for (const round of Object.values(t.rounds ?? {})) {
        for (const m of Object.values(round.matches ?? {})) {
          if (m.score1 == null || m.score2 == null) continue;
          const mA: [string, string] = [m.a1, m.a2];
          const mB: [string, string] = [m.b1, m.b2];

          if (this.samePair(selA, mA) && this.samePair(selB, mB)) {
            found.push({
              tournamentId: t.id,
              tournamentName: t.name,
              createdAt: t.createdAt,
              teamAScore: m.score1,
              teamBScore: m.score2,
            });
          } else if (this.samePair(selA, mB) && this.samePair(selB, mA)) {
            found.push({
              tournamentId: t.id,
              tournamentName: t.name,
              createdAt: t.createdAt,
              teamAScore: m.score2,
              teamBScore: m.score1,
            });
          }
        }
      }
    }

    return found.sort((a, b) => b.createdAt - a.createdAt);
  });
}
