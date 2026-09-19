import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../services/i18n.service';
import {
  DEFAULT_BONUS,
  DEFAULT_SCORING,
  FORMAT_LABELS,
  isDynamicFormat,
  isTeamFormat,
  type StandingRow,
  type Tournament,
  type TournamentFormat,
  type TournamentMatch,
  type TournamentRound,
  type TournamentTeam,
} from '../../models/padel.model';
import {
  computeStandings,
  generateAmericanoRounds,
  generateKothInitialRound,
  generateKothNextRound,
  generateMexericanoFinalRound,
  generateMexericanoRound,
  generateMexicanoRound,
  generateTeamAmericanoRounds,
  generateTeamMexicanoRound,
  standingsOrder,
  validateScore,
} from '../../services/tournament-engine';

interface LocalScore {
  s1: number | null;
  s2: number | null;
}

/**
 * Hidden in-memory sandbox (/test) for exercising every tournament format
 * without Firebase. Mirrors the service's round-progression logic. Not linked
 * from anywhere in the UI.
 */
@Component({
  selector: 'app-mexericano-test',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './mexericano-test.component.html',
  styleUrl: './mexericano-test.component.scss',
})
export class MexericanoTestComponent {
  readonly i18n = inject(I18nService);

  readonly formats: TournamentFormat[] = Object.keys(
    FORMAT_LABELS,
  ) as TournamentFormat[];

  // Config
  readonly format = signal<TournamentFormat>('mexericano');
  readonly numPlayers = signal(8);
  readonly numCourts = signal(2);
  readonly target = signal(24);
  readonly totalRounds = signal(7);

  // State
  readonly started = signal(false);
  readonly finished = signal(false);
  readonly playerIds = signal<string[]>([]);
  readonly names = signal<Record<string, string>>({});
  readonly teams = signal<TournamentTeam[]>([]);
  readonly rounds = signal<TournamentRound[]>([]);
  readonly currentIndex = signal(0);
  readonly scores = signal<Record<string, LocalScore>>({});
  readonly error = signal('');

  // ── Format flags ─────────────────────────────────────────────────────────

  readonly isTeam = computed(() => isTeamFormat(this.format()));
  readonly isDynamic = computed(() => isDynamicFormat(this.format()));
  readonly isKoth = computed(() => this.format() === 'king-of-the-hill');
  readonly isSuperMex = computed(() => this.format() === 'super-mexicano');
  readonly isMexericano = computed(() => this.format() === 'mexericano');
  readonly hasBonus = computed(() => this.isSuperMex() || this.isMexericano());
  readonly isStatic = computed(
    () => this.format() === 'americano' || this.format() === 'team-americano',
  );

  formatLabel(f: TournamentFormat): string {
    return this.i18n.t('format.' + f);
  }
  formatDesc(f: TournamentFormat): string {
    return this.i18n.t('format.' + f + '.desc');
  }

  selectFormat(f: TournamentFormat): void {
    if (this.started()) return;
    this.format.set(f);
  }

  // ── Config helpers ─────────────────────────────────────────────────────────

  setNumPlayers(v: string): void {
    if (v === '') return;
    const n = Number(v);
    if (!Number.isNaN(n)) this.numPlayers.set(n);
  }
  setNumCourts(v: string): void {
    if (v === '') return;
    const n = Number(v);
    if (!Number.isNaN(n)) this.numCourts.set(n);
  }
  setTarget(v: string): void {
    if (v === '') return;
    const n = Number(v);
    if (!Number.isNaN(n)) this.target.set(n);
  }
  setTotalRounds(v: string): void {
    if (v === '') return;
    const n = Number(v);
    if (!Number.isNaN(n)) this.totalRounds.set(n);
  }

  private scoringConfig() {
    return {
      ...DEFAULT_SCORING,
      method: 'fixed-points' as const,
      pointTarget: this.target(),
    };
  }

  private teamMap(): Record<string, TournamentTeam> {
    const map: Record<string, TournamentTeam> = {};
    this.teams().forEach((t) => (map[t.id] = t));
    return map;
  }

  private buildTournament(rounds: TournamentRound[]): Tournament {
    const roundRec: Record<string, TournamentRound> = {};
    rounds.forEach((r) => (roundRec[String(r.index)] = r));
    const base: Tournament = {
      id: 'sandbox',
      name: 'Sandbox',
      format: this.format(),
      status: 'active',
      courtCount: this.numCourts(),
      totalRounds: this.totalRounds(),
      currentRound: this.currentIndex(),
      scoring: this.scoringConfig(),
      seeded: false,
      createdAt: 0,
      rounds: roundRec,
    };
    if (this.isTeam()) {
      const teamsRec: Record<string, TournamentTeam> = {};
      this.teams().forEach((t, i) => (teamsRec[String(i)] = t));
      base.teams = teamsRec;
    } else {
      const pids: Record<string, string> = {};
      this.playerIds().forEach((id, i) => (pids[String(i)] = id));
      base.playerIds = pids;
    }
    if (this.format() === 'super-mexicano' || this.format() === 'mexericano') {
      base.bonus = { ...DEFAULT_BONUS, points: { ...DEFAULT_BONUS.points } };
    }
    return base;
  }

  // ── Names ──────────────────────────────────────────────────────────────────

  playerName(id: string): string {
    return this.names()[id] ?? id;
  }
  teamName(teamId?: string): string {
    if (!teamId) return '';
    return this.teams().find((t) => t.id === teamId)?.name ?? '';
  }
  participantName(id: string): string {
    const team = this.teams().find((t) => t.id === id);
    return team ? team.name : this.playerName(id);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    this.error.set('');
    const ids = Array.from({ length: this.numPlayers() }, (_, i) => `p${i}`);
    const names: Record<string, string> = {};
    ids.forEach((id, i) => (names[id] = this.i18n.t('test.playerName', { n: i + 1 })));
    this.playerIds.set(ids);
    this.names.set(names);

    // Build fixed teams for team formats (consecutive pairs).
    const teams: TournamentTeam[] = [];
    if (this.isTeam()) {
      for (let i = 0; i + 1 < ids.length; i += 2) {
        teams.push({
          id: `t${i / 2}`,
          name: this.i18n.t('test.teamName', { n: i / 2 + 1 }),
          p1: ids[i],
          p2: ids[i + 1],
        });
      }
      if (teams.length < 2) {
        this.error.set(this.i18n.t('err.minTeams'));
        return;
      }
    }
    this.teams.set(teams);
    this.currentIndex.set(0);
    this.finished.set(false);
    this.scores.set({});

    try {
      const generated = this.generateInitialRounds();
      this.rounds.set(generated);
      // team-americano fixes the round count from the schedule length.
      if (this.format() === 'team-americano') {
        this.totalRounds.set(generated.length);
      }
      this.started.set(true);
      const first = generated.find((r) => r.index === 0);
      if (first) this.syncScores(first);
    } catch (e) {
      this.error.set(e instanceof Error ? this.i18n.t(e.message) : String(e));
    }
  }

  reset(): void {
    this.started.set(false);
    this.finished.set(false);
    this.rounds.set([]);
    this.teams.set([]);
    this.scores.set({});
    this.error.set('');
    this.currentIndex.set(0);
  }

  private generateInitialRounds(): TournamentRound[] {
    const courts = this.numCourts();
    const ids = this.playerIds();
    switch (this.format()) {
      case 'americano':
        return generateAmericanoRounds(ids, courts, this.totalRounds());
      case 'team-americano':
        return generateTeamAmericanoRounds(
          this.teams().map((t) => t.id),
          this.teamMap(),
          courts,
        );
      case 'king-of-the-hill':
        return [generateKothInitialRound(ids, courts, false)];
      default:
        return [this.buildDynamicRound(0, [])];
    }
  }

  private buildDynamicRound(
    index: number,
    prior: TournamentRound[],
  ): TournamentRound {
    const order = standingsOrder(this.buildTournament(prior), (id) =>
      this.participantName(id),
    );
    const courts = this.numCourts();
    if (this.format() === 'team-mexicano') {
      return generateTeamMexicanoRound(
        this.teams().map((t) => t.id),
        this.teamMap(),
        courts,
        index,
        prior,
        order,
      );
    }
    if (this.format() === 'mexericano') {
      return generateMexericanoRound(this.playerIds(), courts, index, prior, order);
    }
    return generateMexicanoRound(this.playerIds(), courts, index, prior, order);
  }

  // ── Round data ─────────────────────────────────────────────────────────────

  readonly currentRound = computed<TournamentRound | null>(
    () => this.rounds().find((r) => r.index === this.currentIndex()) ?? null,
  );

  readonly currentMatches = computed<TournamentMatch[]>(() => {
    const round = this.currentRound();
    if (!round?.matches) return [];
    return Object.values(round.matches).sort((a, b) => a.courtIndex - b.courtIndex);
  });

  readonly sitOuts = computed<string[]>(() =>
    Object.values(this.currentRound()?.sitOutIds ?? {}),
  );

  readonly isFinalRound = computed(() => !!this.currentRound()?.isFinal);
  readonly finalGenerated = computed(() => this.rounds().some((r) => r.isFinal));
  readonly completedCount = computed(
    () => this.rounds().filter((r) => r.completed).length,
  );

  readonly canRunFinal = computed(
    () =>
      this.isMexericano() &&
      this.started() &&
      !this.finished() &&
      !this.finalGenerated() &&
      this.completedCount() >= 1 &&
      this.currentMatches().length >= 1 &&
      !this.currentRound()?.completed,
  );

  courtName(index: number): string {
    if (this.isKoth() && index === 0) return this.i18n.t('view.kingCourt');
    return this.i18n.t('court.default', { n: index + 1 });
  }

  private syncScores(round: TournamentRound): void {
    const next: Record<string, LocalScore> = {};
    for (const m of Object.values(round.matches ?? {})) {
      next[m.id] = { s1: m.score1 ?? null, s2: m.score2 ?? null };
    }
    this.scores.set(next);
  }

  // ── Score entry ──────────────────────────────────────────────────────────

  getScore(id: string): LocalScore {
    return this.scores()[id] ?? { s1: null, s2: null };
  }

  setScore(id: string, field: 's1' | 's2', value: string): void {
    const parsed = value === '' ? null : Number(value);
    this.scores.set({
      ...this.scores(),
      [id]: { ...this.getScore(id), [field]: parsed },
    });
  }

  scoreError(id: string): string {
    const s = this.getScore(id);
    if (s.s1 === null || s.s2 === null) return '';
    const v = validateScore(s.s1, s.s2, this.scoringConfig(), this.format());
    return v.valid ? '' : this.i18n.t(v.reason ?? 'err.invalidScore', v.reasonParams);
  }

  readonly allEntered = computed(() => {
    const matches = this.currentMatches();
    if (matches.length === 0) return false;
    return matches.every((m) => {
      const s = this.scores()[m.id];
      return s && s.s1 !== null && s.s2 !== null && !this.scoreError(m.id);
    });
  });

  /** Fill the current round with random valid results summing to the target. */
  randomResults(): void {
    const total = this.target();
    const next = { ...this.scores() };
    for (const m of this.currentMatches()) {
      let s1 = Math.floor(Math.random() * (total + 1));
      // King of the Hill cannot end in a draw.
      if (this.isKoth() && s1 * 2 === total) {
        s1 = s1 === total ? s1 - 1 : s1 + 1;
      }
      next[m.id] = { s1, s2: total - s1 };
    }
    this.scores.set(next);
  }

  // ── Round progression (mirrors PadelService.completeRound) ──────────────────

  completeRound(): void {
    if (!this.allEntered()) return;
    this.error.set('');
    const rounds = this.rounds();
    const idx = this.currentIndex();
    const round = rounds.find((r) => r.index === idx);
    if (!round) return;

    const matches: Record<string, TournamentMatch> = {};
    for (const m of Object.values(round.matches ?? {})) {
      const s = this.getScore(m.id);
      matches[m.id] = { ...m, score1: s.s1 ?? 0, score2: s.s2 ?? 0 };
    }
    const completed: TournamentRound = { ...round, matches, completed: true };
    const updated = rounds.map((r) => (r.index === idx ? completed : r));

    const nextIndex = idx + 1;
    const precomputedNext = updated.find((r) => r.index === nextIndex);
    const isLast =
      !!completed.isFinal ||
      (this.isStatic() ? !precomputedNext : nextIndex >= this.totalRounds());

    if (isLast) {
      this.rounds.set(updated);
      this.finished.set(true);
      return;
    }

    if (this.isStatic()) {
      this.rounds.set(updated);
      this.currentIndex.set(nextIndex);
      if (precomputedNext) this.syncScores(precomputedNext);
      return;
    }

    try {
      let nextRound: TournamentRound;
      if (this.isKoth()) {
        const prior = updated.filter((r) => r.index < idx);
        nextRound = generateKothNextRound(
          completed,
          prior,
          nextIndex,
          this.playerIds(),
        );
      } else {
        nextRound = this.buildDynamicRound(nextIndex, updated);
      }
      this.rounds.set([...updated, nextRound]);
      this.currentIndex.set(nextIndex);
      this.syncScores(nextRound);
    } catch (e) {
      this.rounds.set(updated);
      this.error.set(e instanceof Error ? this.i18n.t(e.message) : String(e));
    }
  }

  runFinal(): void {
    if (!this.canRunFinal()) return;
    this.error.set('');
    const idx = this.currentIndex();
    const prior = this.rounds().filter((r) => r.index < idx);
    const order = standingsOrder(this.buildTournament(prior), (id) =>
      this.participantName(id),
    );
    try {
      const finalRound = generateMexericanoFinalRound(
        this.playerIds(),
        this.numCourts(),
        idx,
        prior,
        order,
      );
      this.rounds.set([...prior, finalRound]);
      this.syncScores(finalRound);
    } catch (e) {
      this.error.set(e instanceof Error ? this.i18n.t(e.message) : String(e));
    }
  }

  goToRound(index: number): void {
    const round = this.rounds().find((r) => r.index === index);
    if (!round) return;
    this.currentIndex.set(index);
    this.syncScores(round);
  }

  // ── Standings ──────────────────────────────────────────────────────────────

  readonly standings = computed<StandingRow[]>(() => {
    if (!this.started()) return [];
    return computeStandings(this.buildTournament(this.rounds()), (id) =>
      this.participantName(id),
    );
  });

  readonly winnerName = computed(() => this.standings()[0]?.name ?? '');

  // ── Anti-repeat diagnostics ─────────────────────────────────────────────────

  private pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  /** Repeat diagnostics across all generated rounds (individual formats only). */
  readonly diagnostics = computed(() => {
    const partner = new Map<string, number>();
    const opponent = new Map<string, number>();
    const foursome = new Map<string, number>();
    let backToBack = 0;
    const prevPartner: Record<string, string> = {};

    for (const round of [...this.rounds()].sort((a, b) => a.index - b.index)) {
      const curPartner: Record<string, string> = {};
      for (const m of Object.values(round.matches ?? {})) {
        const pk1 = this.pairKey(m.a1, m.a2);
        const pk2 = this.pairKey(m.b1, m.b2);
        partner.set(pk1, (partner.get(pk1) ?? 0) + 1);
        partner.set(pk2, (partner.get(pk2) ?? 0) + 1);
        for (const x of [m.a1, m.a2]) {
          for (const y of [m.b1, m.b2]) {
            const ok = this.pairKey(x, y);
            opponent.set(ok, (opponent.get(ok) ?? 0) + 1);
          }
        }
        const fk = [m.a1, m.a2, m.b1, m.b2].sort().join('|');
        foursome.set(fk, (foursome.get(fk) ?? 0) + 1);
        curPartner[m.a1] = m.a2;
        curPartner[m.a2] = m.a1;
        curPartner[m.b1] = m.b2;
        curPartner[m.b2] = m.b1;
      }
      for (const [id, partnerId] of Object.entries(curPartner)) {
        if (prevPartner[id] === partnerId) backToBack++;
      }
      Object.assign(prevPartner, curPartner);
    }

    const countOver = (map: Map<string, number>) =>
      [...map.values()].filter((v) => v > 1).length;

    return {
      partnerRepeats: countOver(partner),
      opponentRepeats: countOver(opponent),
      foursomeRepeats: countOver(foursome),
      backToBackPartners: backToBack / 2,
    };
  });
}
