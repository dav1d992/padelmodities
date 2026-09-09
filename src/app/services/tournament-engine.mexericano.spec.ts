import {
  DEFAULT_SCORING,
  type Tournament,
  type TournamentMatch,
  type TournamentRound,
} from '../models/padel.model';
import {
  computeStandings,
  generateMexericanoFinalRound,
  generateMexericanoRound,
  standingsOrder,
} from './tournament-engine';

// ── Test helpers ─────────────────────────────────────────────────────────────

function players(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i}`);
}

function matchesOf(round: TournamentRound): TournamentMatch[] {
  return Object.values(round.matches ?? {}).sort(
    (a, b) => a.courtIndex - b.courtIndex,
  );
}

/** playerId → partner id within a round. */
function partnersOf(round: TournamentRound): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of matchesOf(round)) {
    map[m.a1] = m.a2;
    map[m.a2] = m.a1;
    map[m.b1] = m.b2;
    map[m.b2] = m.b1;
  }
  return map;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function opponentPairs(round: TournamentRound): Set<string> {
  const set = new Set<string>();
  for (const m of matchesOf(round)) {
    for (const x of [m.a1, m.a2]) {
      for (const y of [m.b1, m.b2]) set.add(pairKey(x, y));
    }
  }
  return set;
}

function foursomeKey(m: TournamentMatch): string {
  return [m.a1, m.a2, m.b1, m.b2].sort().join('|');
}

function playersInRound(round: TournamentRound): string[] {
  return matchesOf(round).flatMap((m) => [m.a1, m.a2, m.b1, m.b2]);
}

/** Generate `count` sequential rounds, feeding each back as prior history. */
function generateSequence(
  ids: string[],
  courts: number,
  count: number,
  order: string[] = ids,
): TournamentRound[] {
  const rounds: TournamentRound[] = [];
  for (let r = 0; r < count; r++) {
    const round = generateMexericanoRound(ids, courts, r, [...rounds], order);
    rounds.push(round);
  }
  return rounds;
}

function mkMatch(
  id: string,
  courtIndex: number,
  four: [string, string, string, string],
  score1?: number,
  score2?: number,
): TournamentMatch {
  const [a1, a2, b1, b2] = four;
  return { id, courtIndex, a1, a2, b1, b2, score1, score2 };
}

function mkRound(
  index: number,
  matches: TournamentMatch[],
  opts: { completed?: boolean; isFinal?: boolean; sitOuts?: string[] } = {},
): TournamentRound {
  const matchRec: Record<string, TournamentMatch> = {};
  matches.forEach((m) => (matchRec[m.id] = m));
  const sitRec: Record<string, string> = {};
  (opts.sitOuts ?? []).forEach((id, i) => (sitRec[String(i)] = id));
  return {
    index,
    completed: opts.completed ?? false,
    matches: matchRec,
    sitOutIds: sitRec,
    ...(opts.isFinal ? { isFinal: true } : {}),
  };
}

function mkTournament(ids: string[], rounds: TournamentRound[]): Tournament {
  const roundRec: Record<string, TournamentRound> = {};
  rounds.forEach((r) => (roundRec[String(r.index)] = r));
  const pids: Record<string, string> = {};
  ids.forEach((id, i) => (pids[String(i)] = id));
  return {
    id: 't',
    name: 'T',
    format: 'mexericano',
    status: 'active',
    playerIds: pids,
    courtCount: 2,
    totalRounds: 5,
    currentRound: 0,
    scoring: { ...DEFAULT_SCORING },
    seeded: false,
    createdAt: 0,
    rounds: roundRec,
  };
}

const nameOf = (id: string) => id;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Mexericano', () => {
  // 1. Individual score calculation.
  it('awards each player their side score cumulatively', () => {
    const ids = players(4);
    const round = mkRound(
      0,
      [mkMatch('m0', 0, ['p0', 'p1', 'p2', 'p3'], 7, 5)],
      { completed: true },
    );
    const t = mkTournament(ids, [round]);
    const standings = computeStandings(t, nameOf);
    const by = (id: string) => standings.find((r) => r.participantId === id)!;
    expect(by('p0').total).toBe(7);
    expect(by('p1').total).toBe(7);
    expect(by('p2').total).toBe(5);
    expect(by('p3').total).toBe(5);
  });

  it('does not reset scores between rounds (cumulative)', () => {
    const ids = players(4);
    const r0 = mkRound(0, [mkMatch('r0m0', 0, ['p0', 'p1', 'p2', 'p3'], 6, 4)], {
      completed: true,
    });
    const r1 = mkRound(1, [mkMatch('r1m0', 0, ['p0', 'p2', 'p1', 'p3'], 7, 3)], {
      completed: true,
    });
    const t = mkTournament(ids, [r0, r1]);
    const standings = computeStandings(t, nameOf);
    const by = (id: string) => standings.find((r) => r.participantId === id)!;
    expect(by('p0').total).toBe(13); // 6 + 7
    expect(by('p2').total).toBe(11); // 4 + 7
  });

  // 2. Ranking calculation.
  it('ranks players by cumulative points, best first', () => {
    const ids = players(4);
    const round = mkRound(
      0,
      [mkMatch('m0', 0, ['p0', 'p1', 'p2', 'p3'], 8, 4)],
      { completed: true },
    );
    const t = mkTournament(ids, [round]);
    const order = standingsOrder(t, nameOf);
    expect(order.slice(0, 2).sort()).toEqual(['p0', 'p1']);
    expect(order.slice(2).sort()).toEqual(['p2', 'p3']);
  });

  // 3. Partner-repeat prevention.
  it('avoids repeating the previous round partner when avoidable', () => {
    const ids = players(8);
    const rounds = generateSequence(ids, 2, 6);
    for (let r = 1; r < rounds.length; r++) {
      const prev = partnersOf(rounds[r - 1]);
      const cur = partnersOf(rounds[r]);
      for (const id of ids) {
        if (cur[id] && prev[id]) {
          expect(cur[id]).not.toBe(prev[id]);
        }
      }
    }
  });

  // 4. Opponent-repeat prevention.
  it('keeps opponent repeats low between consecutive rounds', () => {
    const ids = players(8);
    const rounds = generateSequence(ids, 2, 3);
    const first = opponentPairs(rounds[0]);
    const second = opponentPairs(rounds[1]);
    let repeats = 0;
    second.forEach((p) => first.has(p) && repeats++);
    // With 8 players and 2 courts a near-fresh set of opponents is achievable.
    expect(repeats).toBeLessThanOrEqual(2);
  });

  // 5. Exact-matchup repeat prevention.
  it('does not reproduce an identical four-player matchup when avoidable', () => {
    const ids = players(8);
    const rounds = generateSequence(ids, 2, 5);
    const seen = new Set<string>();
    for (const round of rounds) {
      for (const m of matchesOf(round)) {
        const key = foursomeKey(m);
        expect(seen.has(key)).toBeFalse();
        seen.add(key);
      }
    }
  });

  // 6. Competitive ranking-based matchmaking.
  it('groups players by ranking window (rigid window keeps top four on court 0)', () => {
    const ids = players(16);
    const order = [...ids]; // p0 best … p15 worst
    const round = generateMexericanoRound(ids, 4, 3, [], order, {
      rankingWindow: 0,
    });
    const court0 = matchesOf(round)[0];
    expect(foursomeKey(court0)).toBe(['p0', 'p1', 'p2', 'p3'].sort().join('|'));
  });

  it('keeps higher-ranked players on lower court indices on average', () => {
    const ids = players(16);
    const order = [...ids];
    const round = generateMexericanoRound(ids, 4, 3, [], order, {
      rankingWindow: 2,
    });
    const rank = (id: string) => order.indexOf(id);
    const avg = (m: TournamentMatch) =>
      [m.a1, m.a2, m.b1, m.b2].reduce((s, id) => s + rank(id), 0) / 4;
    const courts = matchesOf(round);
    expect(avg(courts[0])).toBeLessThan(avg(courts[courts.length - 1]));
  });

  // 7. Normal Mexericano round generation.
  it('generates a structurally valid round', () => {
    const ids = players(10);
    const round = generateMexericanoRound(ids, 2, 0, [], ids);
    const inRound = playersInRound(round);
    expect(inRound.length).toBe(8); // 2 courts × 4
    expect(new Set(inRound).size).toBe(8); // no duplicates
    expect(Object.values(round.sitOutIds ?? {}).length).toBe(2);
    expect(round.isFinal).toBeFalsy();
  });

  // 8. Final-round generation.
  it('flags the final round and keeps it structurally valid', () => {
    const ids = players(8);
    const prior = generateSequence(ids, 2, 2);
    const round = generateMexericanoFinalRound(ids, 2, 2, prior, ids);
    expect(round.isFinal).toBeTrue();
    const inRound = playersInRound(round);
    expect(new Set(inRound).size).toBe(inRound.length);
  });

  // 9. Final round prioritizing top-ranked players.
  it('puts the top-ranked players together on court 0 in the final', () => {
    const ids = players(16);
    const order = [...ids];
    const round = generateMexericanoFinalRound(ids, 4, 4, [], order);
    const court0 = matchesOf(round)[0];
    expect(foursomeKey(court0)).toBe(['p0', 'p1', 'p2', 'p3'].sort().join('|'));
  });

  // 10. Final-round idempotency (pure generator does not mutate history).
  it('is a pure generator: repeated calls yield final rounds without mutating history', () => {
    const ids = players(8);
    const prior = generateSequence(ids, 2, 2);
    const before = prior.length;
    const a = generateMexericanoFinalRound(ids, 2, 2, prior, ids);
    const b = generateMexericanoFinalRound(ids, 2, 2, prior, ids);
    expect(a.isFinal).toBeTrue();
    expect(b.isFinal).toBeTrue();
    expect(prior.length).toBe(before);
  });

  // 11. Tied scores.
  it('breaks tied totals deterministically by name', () => {
    const ids = players(4);
    const round = mkRound(
      0,
      [mkMatch('m0', 0, ['p1', 'p3', 'p0', 'p2'], 6, 6)],
      { completed: true },
    );
    const t = mkTournament(ids, [round]);
    const standings = computeStandings(t, nameOf);
    expect(standings.every((r) => r.total === 6)).toBeTrue();
    expect(standings.map((r) => r.participantId)).toEqual([
      'p0',
      'p1',
      'p2',
      'p3',
    ]);
  });

  // 12. Impossible anti-repeat scenarios.
  it('still produces a valid round when repeats are unavoidable (4 players, 1 court)', () => {
    const ids = players(4);
    const rounds: TournamentRound[] = [];
    for (let r = 0; r < 5; r++) {
      const round = generateMexericanoRound(ids, 1, r, [...rounds], ids);
      const inRound = playersInRound(round);
      expect(inRound.length).toBe(4);
      expect(new Set(inRound).size).toBe(4);
      rounds.push(round);
    }
  });

  // 13. Correct leaderboard after final-round results.
  it('computes the final leaderboard including final-round results', () => {
    const ids = players(4);
    const r0 = mkRound(0, [mkMatch('r0m0', 0, ['p0', 'p1', 'p2', 'p3'], 5, 5)], {
      completed: true,
    });
    const rFinal = mkRound(
      1,
      [mkMatch('r1m0', 0, ['p0', 'p2', 'p1', 'p3'], 9, 1)],
      { completed: true, isFinal: true },
    );
    const t = mkTournament(ids, [r0, rFinal]);
    const standings = computeStandings(t, nameOf);
    // p0: 5 + 9 = 14 (winner), p2: 5 + 9 = 14, p1: 5 + 1 = 6, p3: 5 + 1 = 6.
    const by = (id: string) => standings.find((r) => r.participantId === id)!;
    expect(by('p0').total).toBe(14);
    expect(by('p2').total).toBe(14);
    expect(by('p1').total).toBe(6);
    expect(by('p3').total).toBe(6);
    expect(standings[0].total).toBe(14);
  });
});
