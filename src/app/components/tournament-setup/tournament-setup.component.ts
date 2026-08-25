import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  PadelService,
  type CreateTournamentInput,
} from '../../services/padel.service';
import { I18nService } from '../../services/i18n.service';
import {
  DEFAULT_BONUS,
  DEFAULT_SCORING,
  isDynamicFormat,
  isTeamFormat,
  type CourtBonusConfig,
  type Player,
  type ScoringConfig,
  type ScoringMethod,
  type Tournament,
  type TournamentFormat,
  type TournamentTeam,
} from '../../models/padel.model';
import { CommonModule } from '@angular/common';

interface FormatOption {
  value: TournamentFormat;
}

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
  private route = inject(ActivatedRoute);
  readonly i18n = inject(I18nService);

  readonly formatOptions: FormatOption[] = [
    { value: 'americano' },
    { value: 'team-americano' },
    { value: 'mexicano' },
    { value: 'team-mexicano' },
    { value: 'super-mexicano' },
    { value: 'king-of-the-hill' },
  ];

  readonly scoringMethods: ScoringMethod[] = [
    'fixed-points',
    'first-to',
    'games-sets',
    'timed',
  ];

  readonly players = signal<Player[]>([]);

  // Core config
  readonly tournamentName = signal('');
  readonly format = signal<TournamentFormat>('americano');
  readonly seeded = signal(false);
  readonly courtNames = signal<string[]>([
    this.i18n.t('court.default', { n: 1 }),
    this.i18n.t('court.default', { n: 2 }),
  ]);
  readonly totalRounds = signal(7);

  // Scoring
  readonly scoring = signal<ScoringConfig>({ ...DEFAULT_SCORING });

  // Court bonus (super mexicano)
  readonly bonus = signal<CourtBonusConfig>({
    ...DEFAULT_BONUS,
    points: { ...DEFAULT_BONUS.points },
  });

  // Individual selection
  readonly selectedIds = signal<Set<string>>(new Set());

  // Team building
  readonly teams = signal<TournamentTeam[]>([]);
  readonly teamPick = signal<string[]>([]);
  readonly teamName = signal('');

  readonly submitting = signal(false);
  readonly error = signal('');

  private draftId: string | null = null;
  private draftLoaded = false;
  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.draftId = this.route.snapshot.queryParamMap.get('draft');
    this.subs.push(
      this.service.watchPlayers().subscribe((list) => {
        this.players.set(list);
        this.maybeLoadDraft();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private maybeLoadDraft(): void {
    if (!this.draftId || this.draftLoaded) return;
    this.draftLoaded = true;
    this.subs.push(
      this.service.watchTournament(this.draftId).subscribe((t) => {
        if (t) this.populateFromDraft(t);
      }),
    );
  }

  private populateFromDraft(t: Tournament): void {
    this.tournamentName.set(t.name);
    this.format.set(t.format);
    this.seeded.set(t.seeded);
    this.courtNames.set(
      Object.keys(t.courtNames ?? {})
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => t.courtNames![k]),
    );
    this.totalRounds.set(t.totalRounds || 7);
    this.scoring.set({ ...DEFAULT_SCORING, ...t.scoring });
    if (t.bonus) this.bonus.set({ ...t.bonus, points: { ...t.bonus.points } });
    if (isTeamFormat(t.format)) {
      this.teams.set(Object.values(t.teams ?? {}));
    } else {
      this.selectedIds.set(new Set(Object.values(t.playerIds ?? {})));
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────

  readonly isTeam = computed(() => isTeamFormat(this.format()));
  readonly isDynamic = computed(() => isDynamicFormat(this.format()));
  readonly isKoth = computed(() => this.format() === 'king-of-the-hill');
  readonly isSuperMex = computed(() => this.format() === 'super-mexicano');
  readonly isRoundRobin = computed(() => this.format() === 'team-americano');
  readonly courtCount = computed(() => this.courtNames().length);

  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly teamCount = computed(() => this.teams().length);

  /** Players not already assigned to a team. */
  readonly availableForTeams = computed(() => {
    const used = new Set(this.teams().flatMap((t) => [t.p1, t.p2]));
    return this.players().filter((p) => !used.has(p.id));
  });

  /** Active participants that can be scheduled per round. */
  readonly perRoundInfo = computed(() => {
    const courts = this.courtCount();
    if (this.isTeam()) {
      const teams = this.teamCount();
      const matches = Math.min(courts, Math.floor(teams / 2));
      return { matches, active: matches * 2, sitOut: teams - matches * 2 };
    }
    const n = this.selectedCount();
    const matches = Math.min(courts, Math.floor(n / 4));
    return { matches, active: matches * 4, sitOut: n - matches * 4 };
  });

  readonly validation = computed<{ ok: boolean; messages: string[] }>(() => {
    const messages: string[] = [];
    if (this.tournamentName().trim().length === 0) {
      messages.push(this.i18n.t('val.name'));
    }
    if (this.courtCount() < 1) messages.push(this.i18n.t('val.court'));

    if (this.isTeam()) {
      if (this.teamCount() < 2) messages.push(this.i18n.t('val.teams'));
    } else if (this.isKoth()) {
      const needed = this.courtCount() * 4;
      if (this.courtCount() < 2)
        messages.push(this.i18n.t('val.kothCourts'));
      if (this.selectedCount() < needed)
        messages.push(this.i18n.t('val.kothPlayers', { n: needed }));
    } else {
      if (this.selectedCount() < 4) messages.push(this.i18n.t('val.min4'));
    }

    if (!this.isTeam() && this.perRoundInfo().matches < 1) {
      messages.push(this.i18n.t('val.fillCourt'));
    }
    if (!this.isRoundRobin() && this.totalRounds() < 1) {
      messages.push(this.i18n.t('val.minRound'));
    }
    return { ok: messages.length === 0, messages };
  });

  /** Soft warning when a perfectly fair schedule is impossible. */
  readonly fairnessWarning = computed(() => {
    const info = this.perRoundInfo();
    if (info.sitOut > 0 && !this.isKoth()) {
      const who = this.isTeam() ? this.i18n.t('who.teams') : this.i18n.t('who.players');
      return this.i18n.t('val.fairness', { n: info.sitOut, who });
    }
    return '';
  });

  readonly canSubmit = computed(() => this.validation().ok);

  // ── Format ──────────────────────────────────────────────────────────────

  selectFormat(f: TournamentFormat): void {
    this.format.set(f);
    if (f === 'king-of-the-hill' && this.courtCount() < 2) {
      this.courtNames.set([
        this.i18n.t('court.king'),
        this.i18n.t('court.default', { n: 2 }),
      ]);
    }
  }

  // ── Scoring ─────────────────────────────────────────────────────────────

  setScoringMethod(m: ScoringMethod): void {
    this.scoring.set({ ...this.scoring(), method: m });
  }

  patchScoring<K extends keyof ScoringConfig>(
    key: K,
    value: ScoringConfig[K],
  ): void {
    this.scoring.set({ ...this.scoring(), [key]: value });
  }

  // ── Courts ──────────────────────────────────────────────────────────────

  addCourt(): void {
    const next = [...this.courtNames()];
    next.push(this.i18n.t('court.default', { n: next.length + 1 }));
    this.courtNames.set(next);
  }

  removeCourt(index: number): void {
    if (this.courtNames().length <= 1) return;
    this.courtNames.set(this.courtNames().filter((_, i) => i !== index));
  }

  setCourtName(index: number, name: string): void {
    const next = [...this.courtNames()];
    next[index] = name;
    this.courtNames.set(next);
  }

  // ── Bonus ───────────────────────────────────────────────────────────────

  bonusForCourt(index: number): number {
    return this.bonus().points[String(index)] ?? 0;
  }

  setBonusForCourt(index: number, value: number): void {
    const points = { ...this.bonus().points, [String(index)]: value };
    this.bonus.set({ ...this.bonus(), points });
  }

  patchBonus<K extends keyof CourtBonusConfig>(
    key: K,
    value: CourtBonusConfig[K],
  ): void {
    this.bonus.set({ ...this.bonus(), [key]: value });
  }

  // ── Individual selection ────────────────────────────────────────────────

  togglePlayer(id: string): void {
    const next = new Set(this.selectedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedIds.set(next);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  // ── Team building ───────────────────────────────────────────────────────

  toggleTeamPick(id: string): void {
    const cur = this.teamPick();
    if (cur.includes(id)) {
      this.teamPick.set(cur.filter((x) => x !== id));
    } else if (cur.length < 2) {
      this.teamPick.set([...cur, id]);
    }
  }

  isPicked(id: string): boolean {
    return this.teamPick().includes(id);
  }

  playerName(id: string): string {
    return this.players().find((p) => p.id === id)?.name ?? id;
  }

  addTeam(): void {
    const pick = this.teamPick();
    if (pick.length !== 2) return;
    const name =
      this.teamName().trim() ||
      `${this.playerName(pick[0])} & ${this.playerName(pick[1])}`;
    const team: TournamentTeam = {
      id: crypto.randomUUID(),
      name,
      p1: pick[0],
      p2: pick[1],
    };
    this.teams.set([...this.teams(), team]);
    this.teamPick.set([]);
    this.teamName.set('');
  }

  removeTeam(id: string): void {
    this.teams.set(this.teams().filter((t) => t.id !== id));
  }

  // ── Submit ──────────────────────────────────────────────────────────────

  private buildInput(status: 'draft' | 'active'): CreateTournamentInput {
    return {
      name: this.tournamentName(),
      format: this.format(),
      playerIds: this.isTeam() ? [] : [...this.selectedIds()],
      teams: this.isTeam() ? this.teams() : undefined,
      courtNames: this.courtNames(),
      totalRounds: this.isRoundRobin() ? 0 : this.totalRounds(),
      scoring: this.scoring(),
      bonus: this.isSuperMex() ? this.bonus() : undefined,
      seeded: this.seeded(),
      status,
    };
  }

  async saveDraft(): Promise<void> {
    if (this.tournamentName().trim().length === 0) {
      this.error.set(this.i18n.t('err.draftName'));
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    try {
      if (this.draftId) {
        await this.service.updateDraft(this.draftId, this.buildInput('draft'));
      } else {
        await this.service.createTournament(this.buildInput('draft'));
      }
      this.router.navigate(['/']);
    } catch (err) {
      this.error.set(err instanceof Error ? this.i18n.t(err.message) : this.i18n.t('common.error'));
    } finally {
      this.submitting.set(false);
    }
  }

  async start(): Promise<void> {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      let id: string;
      if (this.draftId) {
        await this.service.updateDraft(this.draftId, this.buildInput('draft'));
        await this.service.startTournament(this.draftId);
        id = this.draftId;
      } else {
        id = await this.service.createTournament(this.buildInput('active'));
      }
      this.router.navigate(['/tournament', id]);
    } catch (err) {
      this.error.set(err instanceof Error ? this.i18n.t(err.message) : this.i18n.t('common.error'));
      this.submitting.set(false);
    }
  }
}
