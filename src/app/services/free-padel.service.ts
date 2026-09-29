import { inject, Injectable } from '@angular/core';
import {
  ref,
  set,
  update,
  push,
  get,
  remove,
  onValue,
} from 'firebase/database';
import { Observable } from 'rxjs';
import { FIREBASE_DB } from '../core/firebase';
import {
  type CourtBonusConfig,
  type FreeParticipant,
  type FreeTournament,
  type ScoringConfig,
  type TournamentFormat,
  type TournamentTeam,
} from '../models/padel.model';
import {
  completeCurrentRound,
  computeStandings,
  generateInitialRounds,
  regenerateCurrentRound,
  runFinalRound,
} from './tournament-engine';

/** Everything needed to create a free (standalone) tournament draft. */
export interface CreateFreeTournamentInput {
  name: string;
  description?: string;
  /** 4-digit unlock code chosen by the creator. */
  code: string;
  format: TournamentFormat;
  /** Optional seating-phase format (two-phase tournaments). */
  seatingFormat?: TournamentFormat;
  /** Number of rounds in the seating phase (when seatingFormat is set). */
  seatingRounds?: number;
  courtNames: string[];
  totalRounds: number;
  scoring: ScoringConfig;
  bonus?: CourtBonusConfig;
  seeded: boolean;
}

/** Reject if a Firebase call doesn't settle within the timeout. */
function withTimeout<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
  const timeout = new Promise<T>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            "Couldn't reach the database. Check your connection or that the Realtime Database is active.",
          ),
        ),
      ms,
    );
  });
  return Promise.race([promise, timeout]);
}

/**
 * Hosts standalone "free mode" tournaments under the `freeTournaments` path.
 * Deliberately isolated from {@link PadelService}: it never reads or writes the
 * global `players` collection, and never applies ratings or match stats.
 */
@Injectable({ providedIn: 'root' })
export class FreePadelService {
  private db = inject(FIREBASE_DB);

  private path(id: string): string {
    return `freeTournaments/${id}`;
  }

  private name(t: FreeTournament, id: string): string {
    const team = Object.values(t.teams ?? {}).find((x) => x.id === id);
    if (team) return team.name;
    const p = Object.values(t.participants ?? {}).find((x) => x.id === id);
    return p?.name ?? id;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  watchFreeTournament(id: string): Observable<FreeTournament | null> {
    return new Observable<FreeTournament | null>((subscriber) => {
      const tourRef = ref(this.db, this.path(id));
      const unsubscribe = onValue(
        tourRef,
        (snapshot) => subscriber.next(snapshot.val() as FreeTournament | null),
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    });
  }

  /** Live list of all free tournaments, newest first. */
  watchAllFreeTournaments(): Observable<FreeTournament[]> {
    return new Observable<FreeTournament[]>((subscriber) => {
      const listRef = ref(this.db, 'freeTournaments');
      const unsubscribe = onValue(
        listRef,
        (snapshot) => {
          const val =
            (snapshot.val() as Record<string, FreeTournament> | null) ?? {};
          const list = Object.values(val).sort(
            (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
          );
          subscriber.next(list);
        },
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    });
  }

  private async getFree(id: string): Promise<FreeTournament> {
    const snap = await withTimeout(get(ref(this.db, this.path(id))));
    const t = snap.val() as FreeTournament | null;
    if (!t) throw new Error('err.tournamentNotFound');
    return t;
  }

  // ── Create / edit draft ──────────────────────────────────────────────────

  async createFreeTournament(input: CreateFreeTournamentInput): Promise<string> {
    const tourRef = push(ref(this.db, 'freeTournaments'));
    const id = tourRef.key!;

    const courtNames: Record<string, string> = {};
    input.courtNames.forEach((n, i) => {
      courtNames[String(i)] = n.trim() || `Bane ${i + 1}`;
    });

    const record: FreeTournament = {
      id,
      name: input.name.trim(),
      code: input.code,
      format: input.format,
      status: 'draft',
      courtCount: input.courtNames.length,
      courtNames,
      totalRounds: input.totalRounds,
      currentRound: 0,
      scoring: input.scoring,
      seeded: input.seeded,
      participants: {},
      pointsTable: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const description = input.description?.trim();
    if (description) record.description = description;

    if (
      (input.format === 'super-mexicano' || input.format === 'mexericano') &&
      input.bonus
    ) {
      record.bonus = input.bonus;
    }

    if (input.seatingFormat && input.seatingRounds && input.seatingRounds >= 1) {
      record.seatingFormat = input.seatingFormat;
      record.seatingRounds = input.seatingRounds;
    }

    await withTimeout(set(tourRef, record));
    return id;
  }

  /** Patch draft-level configuration (name, code, scoring, courts, …). */
  async updateConfig(
    id: string,
    patch: Partial<CreateFreeTournamentInput>,
  ): Promise<void> {
    const t = await this.getFree(id);
    if (t.status !== 'draft') throw new Error('err.notDraft');

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (patch.name !== undefined) updates['name'] = patch.name.trim();
    if (patch.code !== undefined) updates['code'] = patch.code;
    if (patch.format !== undefined) updates['format'] = patch.format;
    if (patch.seatingFormat !== undefined) {
      updates['seatingFormat'] = patch.seatingFormat ?? null;
    }
    if (patch.seatingRounds !== undefined) {
      updates['seatingRounds'] = patch.seatingRounds ?? null;
    }
    if (patch.totalRounds !== undefined) updates['totalRounds'] = patch.totalRounds;
    if (patch.seeded !== undefined) updates['seeded'] = patch.seeded;
    if (patch.scoring !== undefined) updates['scoring'] = patch.scoring;
    if (patch.description !== undefined) {
      updates['description'] = patch.description.trim() || null;
    }
    if (patch.bonus !== undefined) updates['bonus'] = patch.bonus;
    if (patch.courtNames !== undefined) {
      const courtNames: Record<string, string> = {};
      patch.courtNames.forEach((n, i) => {
        courtNames[String(i)] = n.trim() || `Bane ${i + 1}`;
      });
      updates['courtNames'] = courtNames;
      updates['courtCount'] = patch.courtNames.length;
    }
    await withTimeout(update(ref(this.db, this.path(id)), updates));
  }

  // ── Participants (individual formats) ────────────────────────────────────

  async addParticipant(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    const t = await this.getFree(id);
    if (t.status !== 'draft') throw new Error('err.notDraft');

    const participants = { ...(t.participants ?? {}) };
    const pid = push(ref(this.db, `${this.path(id)}/participants`)).key!;
    const nextIndex = Object.keys(participants).length;
    const participant: FreeParticipant = { id: pid, name: trimmed };

    const playerIds = { ...(t.playerIds ?? {}) };
    const nextPlayerIndex = Object.keys(playerIds).length;

    await withTimeout(
      update(ref(this.db, this.path(id)), {
        [`participants/${nextIndex}`]: participant,
        [`playerIds/${nextPlayerIndex}`]: pid,
        updatedAt: Date.now(),
      }),
    );
  }

  async renameParticipant(id: string, pid: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    const t = await this.getFree(id);
    if (t.status !== 'draft') throw new Error('err.notDraft');

    const entry = Object.entries(t.participants ?? {}).find(
      ([, p]) => p.id === pid,
    );
    if (!entry) return;
    await withTimeout(
      update(ref(this.db, `${this.path(id)}/participants/${entry[0]}`), {
        name: trimmed,
      }),
    );
  }

  async removeParticipant(id: string, pid: string): Promise<void> {
    const t = await this.getFree(id);
    if (t.status !== 'draft') throw new Error('err.notDraft');

    // Re-pack both maps by index so RTDB keys stay contiguous.
    const participants = Object.values(t.participants ?? {}).filter(
      (p) => p.id !== pid,
    );
    const playerIds = Object.values(t.playerIds ?? {}).filter((x) => x !== pid);
    // Drop any team that referenced the removed participant.
    const teams = Object.values(t.teams ?? {}).filter(
      (tm) => tm.p1 !== pid && tm.p2 !== pid,
    );

    await withTimeout(
      update(ref(this.db, this.path(id)), {
        participants: this.indexRecord(participants),
        playerIds: this.indexRecord(playerIds.map((x) => x)),
        teams: teams.length ? this.indexRecord(teams) : null,
        updatedAt: Date.now(),
      }),
    );
  }

  // ── Teams (team formats) ─────────────────────────────────────────────────

  async setTeams(id: string, teams: TournamentTeam[]): Promise<void> {
    const t = await this.getFree(id);
    if (t.status !== 'draft') throw new Error('err.notDraft');
    await withTimeout(
      update(ref(this.db, this.path(id)), {
        teams: teams.length ? this.indexRecord(teams) : null,
        updatedAt: Date.now(),
      }),
    );
  }

  private indexRecord<T>(items: T[]): Record<string, T> {
    const rec: Record<string, T> = {};
    items.forEach((item, i) => (rec[String(i)] = item));
    return rec;
  }

  // ── Start / play ─────────────────────────────────────────────────────────

  async startFreeTournament(id: string): Promise<void> {
    const t = await this.getFree(id);
    if (t.status !== 'draft') throw new Error('err.notActive');

    const active: FreeTournament = { ...t, status: 'active', currentRound: 0 };
    const { rounds, totalRounds } = generateInitialRounds(active);

    await withTimeout(
      update(ref(this.db, this.path(id)), {
        status: 'active',
        currentRound: 0,
        totalRounds,
        rounds,
        updatedAt: Date.now(),
      }),
    );
    await this.refreshPointsTable(id);
  }

  async saveMatchScore(
    id: string,
    roundIndex: number,
    matchId: string,
    score1: number,
    score2: number,
  ): Promise<void> {
    await withTimeout(
      update(
        ref(this.db, `${this.path(id)}/rounds/${roundIndex}/matches/${matchId}`),
        { score1, score2 },
      ),
    );
    await this.refreshPointsTable(id);
  }

  async resetMatchScore(
    id: string,
    roundIndex: number,
    matchId: string,
  ): Promise<void> {
    await withTimeout(
      update(
        ref(this.db, `${this.path(id)}/rounds/${roundIndex}/matches/${matchId}`),
        { score1: null, score2: null, setScores: null },
      ),
    );
    await this.refreshPointsTable(id);
  }

  async completeRound(id: string): Promise<void> {
    const t = await this.getFree(id);
    const result = completeCurrentRound(t) as FreeTournament;
    await withTimeout(
      update(ref(this.db, this.path(id)), {
        rounds: result.rounds,
        status: result.status,
        currentRound: result.currentRound,
        updatedAt: Date.now(),
      }),
    );
    await this.refreshPointsTable(id);
  }

  async regenerateCurrentRound(id: string): Promise<void> {
    const t = await this.getFree(id);
    const result = regenerateCurrentRound(t) as FreeTournament;
    const roundIndex = result.currentRound;
    await withTimeout(
      set(
        ref(this.db, `${this.path(id)}/rounds/${roundIndex}`),
        result.rounds![roundIndex],
      ),
    );
  }

  async runFinalRound(id: string): Promise<void> {
    const t = await this.getFree(id);
    const result = runFinalRound(t) as FreeTournament;
    const roundIndex = result.currentRound;
    await withTimeout(
      set(
        ref(this.db, `${this.path(id)}/rounds/${roundIndex}`),
        result.rounds![roundIndex],
      ),
    );
  }

  async finishTournament(id: string): Promise<void> {
    await withTimeout(
      update(ref(this.db, this.path(id)), {
        status: 'finished',
        updatedAt: Date.now(),
      }),
    );
    await this.refreshPointsTable(id);
  }

  async deleteFreeTournament(id: string): Promise<void> {
    await withTimeout(remove(ref(this.db, this.path(id))));
  }

  private async refreshPointsTable(id: string): Promise<void> {
    const t = await this.getFree(id);
    const standings = computeStandings(t, (pid) => this.name(t, pid));
    const pointsTable: Record<string, number> = {};
    standings.forEach((row) => (pointsTable[row.participantId] = row.total));
    await withTimeout(
      update(ref(this.db, this.path(id)), { pointsTable }),
    );
  }
}
