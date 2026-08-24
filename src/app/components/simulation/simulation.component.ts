import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PadelService } from '../../services/padel.service';
import { I18nService } from '../../services/i18n.service';
import {
  estimateMatchScore,
  playerMatchStrength,
  SIM_TOTAL_POINTS,
  type Player,
} from '../../models/padel.model';

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './simulation.component.html',
  styleUrl: './simulation.component.scss',
})
export class SimulationComponent implements OnInit, OnDestroy {
  private service = inject(PadelService);
  readonly i18n = inject(I18nService);

  readonly players = signal<Player[]>([]);
  readonly loading = signal(true);

  readonly a1 = signal<string>('');
  readonly a2 = signal<string>('');
  readonly b1 = signal<string>('');
  readonly b2 = signal<string>('');

  readonly sortedPlayers = computed(() =>
    [...this.players()].sort((a, b) => a.name.localeCompare(b.name, 'da')),
  );

  /** Portraits used for the decorative side rails (desktop only). */
  private readonly sideImages = computed(() =>
    this.players()
      .filter((p) => p.shortname)
      .map((p) => `/assets/${p.shortname}-padel.png`),
  );
  readonly leftImages = computed(() => this.shuffle(this.sideImages()));
  readonly rightImages = computed(() => this.shuffle(this.sideImages()));

  private shuffle(list: string[]): string[] {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.service.watchPlayers().subscribe({
      next: (list) => {
        this.players.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
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
}
