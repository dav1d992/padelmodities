import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PadelService } from '../../services/padel.service';
import { AudioService } from '../../services/audio.service';
import { AdminService } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
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
  readonly i18n = inject(I18nService);

  readonly FORMAT_LABELS = FORMAT_LABELS;

  readonly players = signal<Player[]>([]);
  readonly tournaments = signal<Tournament[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  private subs: Subscription[] = [];

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

  ngOnInit(): void {
    this.subs.push(
      this.service.watchPlayers().subscribe({
        next: (list) => {
          this.players.set(list);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message ? this.i18n.t(err.message) : this.i18n.t('err.loadPlayers'));
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
