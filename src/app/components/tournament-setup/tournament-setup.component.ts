import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PadelService } from '../../services/padel.service';
import type { Player, TournamentFormat } from '../../models/padel.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tournament-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tournament-setup.component.html',
  styleUrl: './tournament-setup.component.scss',
})
export class TournamentSetupComponent implements OnInit, OnDestroy {
  private service = inject(PadelService);
  private router = inject(Router);

  readonly players = signal<Player[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly tournamentName = signal('');
  readonly format = signal<TournamentFormat>('americano');
  readonly submitting = signal(false);
  readonly error = signal('');

  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.service.watchPlayers().subscribe((list) =>
      this.players.set(list),
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  readonly selectedCount = computed(() => this.selectedIds().size);

  readonly canCreate = computed(() => {
    const n = this.selectedCount();
    return (
      this.tournamentName().trim().length > 0 && n >= 4 && n % 2 === 0
    );
  });

  readonly validationHint = computed(() => {
    const n = this.selectedCount();
    if (n < 4) return `Vælg mindst 4 spillere (${n} valgt)`;
    if (n % 2 !== 0) return `Spillerantal skal være lige (${n} valgt)`;
    return `${n} spillere valgt ✓`;
  });

  togglePlayer(id: string): void {
    const next = new Set(this.selectedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedIds.set(next);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  async create(): Promise<void> {
    if (!this.canCreate()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const id = await this.service.createTournament(
        this.tournamentName(),
        this.format(),
        [...this.selectedIds()],
      );
      this.router.navigate(['/tournament', id]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Noget gik galt.');
      this.submitting.set(false);
    }
  }
}
