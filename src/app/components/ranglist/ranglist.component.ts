import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PadelService } from '../../services/padel.service';
import { AudioService } from '../../services/audio.service';
import { AdminService } from '../../services/admin.service';
import { FORMAT_LABELS, type Player, type Tournament } from '../../models/padel.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ranglist',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ranglist.component.html',
  styleUrl: './ranglist.component.scss',
})
export class RanglistComponent implements OnInit, OnDestroy {
  private service = inject(PadelService);
  readonly audioSvc = inject(AudioService);
  readonly admin = inject(AdminService);
  private router = inject(Router);

  readonly FORMAT_LABELS = FORMAT_LABELS;

  readonly players = signal<Player[]>([]);
  readonly tournaments = signal<Tournament[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.subs.push(
      this.service.watchPlayers().subscribe({
        next: (list) => {
          this.players.set(list);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Kunne ikke hente spillere.');
          this.loading.set(false);
        },
      }),
      this.service.watchTournaments().subscribe({
        next: (list) => this.tournaments.set(list),
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  rankMedal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  }

  activeTournaments(): Tournament[] {
    return this.tournaments().filter((t) => t.status === 'active');
  }

  draftTournaments(): Tournament[] {
    return this.tournaments().filter((t) => t.status === 'draft');
  }

  recentTournaments(): Tournament[] {
    return this.tournaments()
      .filter((t) => t.status === 'finished')
      .slice(0, 5);
  }

  goToTournament(id: string): void {
    this.router.navigate(['/tournament', id]);
  }
}
