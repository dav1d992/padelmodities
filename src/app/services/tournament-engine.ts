/**
 * Pure tournament logic: schedule generation, standings, scoring and King of
 * the Hill ladder mechanics. Everything here is deterministic-friendly and
 * side-effect free so it can be unit-tested and reused by the service and the
 * UI. Standings and KotH stats are always recomputed from the stored rounds,
 * which keeps score-editing correct without cascading state.
 */
import {
  isTeamFormat,
  type CourtBonusConfig,
  type KothStats,
  type ScoringConfig,
  type StandingRow,
  type Tournament,
  type TournamentFormat,
  type TournamentMatch,
  type TournamentRound,
  type TournamentTeam,
} from '../models/padel.model';

// ── Small utilities ──────────────────────────────────────────────────────────

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(input: readonly T[]): T[] {
  const shuffled = [...input];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ── History (partner / opponent / sit-out counts) ────────────────────────────

export interface ScheduleHistory {
  partner: Record<string, number>;
  opponent: Record<string, number>;
  sitOuts: Record<string, number>;
  /** Round index each participant last sat out (-1 if never). */
  lastSitOutRound: Record<string, number>;
}

/** Build partner/opponent/sit-out history from all rounds up to (not incl.) upTo. */
export function buildHistory(
  rounds: TournamentRound[],
  participantIds: string[],
  upTo = Number.MAX_SAFE_INTEGER,
): ScheduleHistory {
  const partner: Record<string, number> = {};
  const opponent: Record<string, number> = {};
  const sitOuts: Record<string, number> = {};
  const lastSitOutRound: Record<string, number> = {};
  participantIds.forEach((id) => {
    sitOuts[id] = 0;
    lastSitOutRound[id] = -1;
  });

  const bump = (map: Record<string, number>, a: string, b: string) => {
    const k = pairKey(a, b);
    map[k] = (map[k] ?? 0) + 1;
  };

  for (const round of rounds) {
    if (round.index >= upTo) continue;
    for (const m of Object.values(round.matches ?? {})) {
      // In team formats the "pair" is the team; partner variety is irrelevant,
      // but opponent tracking of the two team ids still helps.
      bump(partner, m.a1, m.a2);
      bump(partner, m.b1, m.b2);
      for (const x of [m.a1, m.a2]) {
        for (const y of [m.b1, m.b2]) bump(opponent, x, y);
      }
    }
    for (const id of Object.values(round.sitOutIds ?? {})) {
      sitOuts[id] = (sitOuts[id] ?? 0) + 1;
      lastSitOutRound[id] = round.index;
    }
  }
  return { partner, opponent, sitOuts, lastSitOutRound };
}

function partnerRepeat(h: ScheduleHistory, a: string, b: string): number {
  return h.partner[pairKey(a, b)] ?? 0;
}
function opponentRepeat(h: ScheduleHistory, a: string, b: string): number {
  return h.opponent[pairKey(a, b)] ?? 0;
}

// ── Sit-out selection ────────────────────────────────────────────────────────

/**
 * Pick `count` participants to sit out, favouring those who have sat out least
 * and avoiding back-to-back sit-outs where possible.
 */
function pickSitters(
  candidates: string[],
  count: number,
  h: ScheduleHistory,
  roundIndex: number,
  standingsOrder?: string[],
): string[] {
  if (count <= 0) return [];
  const rank = new Map<string, number>();
  standingsOrder?.forEach((id, i) => rank.set(id, i));

  const scored = candidates.map((id) => {
    const satLast = h.lastSitOutRound[id] === roundIndex - 1 ? 1 : 0;
    return {
      id,
      sits: h.sitOuts[id] ?? 0,
      satLast,
      // Lower-ranked participants sit first when standings provided.
      rank: rank.get(id) ?? 0,
      rnd: Math.random(),
    };
  });
  scored.sort(
    (a, b) =>
      a.satLast - b.satLast ||
      a.sits - b.sits ||
      b.rank - a.rank ||
      a.rnd - b.rnd,
  );
  return scored.slice(0, count).map((s) => s.id);
}

// ── Court/match building for four players ────────────────────────────────────

const PAIRINGS: [[number, number], [number, number]][] = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

/** Choose the split of four players that best avoids repeat partners/opponents. */
function bestFourSplit(
  four: string[],
  h: ScheduleHistory,
  preferIndex = 2, // default Mexicano rule: 1&4 vs 2&3
): { a1: string; a2: string; b1: string; b2: string } {
  let best = PAIRINGS[preferIndex];
  let bestCost = Number.POSITIVE_INFINITY;
  PAIRINGS.forEach((pairing, index) => {
    const [[i, j], [k, l]] = pairing;
    const cost =
      partnerRepeat(h, four[i], four[j]) * 3 +
      partnerRepeat(h, four[k], four[l]) * 3 +
      opponentRepeat(h, four[i], four[k]) +
      opponentRepeat(h, four[i], four[l]) +
      opponentRepeat(h, four[j], four[k]) +
      opponentRepeat(h, four[j], four[l]) +
      (index === preferIndex ? -0.5 : 0); // slight tie-break toward preferred
    if (cost < bestCost) {
      bestCost = cost;
      best = pairing;
    }
  });
  const [[i, j], [k, l]] = best;
  return { a1: four[i], a2: four[j], b1: four[k], b2: four[l] };
}

// ── Individual Americano (static, precompute all rounds) ─────────────────────

/**
 * Generate all rounds for an individual Americano: rotate partners/opponents to
 * maximise variety, spread sit-outs fairly. Uses randomised best-of-K search.
 */
export function generateAmericanoRounds(
  playerIds: string[],
  courtCount: number,
  totalRounds: number,
): TournamentRound[] {
  const n = playerIds.length;
  const perRound = 4 * Math.min(courtCount, Math.floor(n / 4));
  if (perRound < 4) throw new Error('err.americano4');
  const sitCount = n - perRound;

  const rounds: TournamentRound[] = [];
  const running: TournamentRound[] = [];

  for (let r = 0; r < totalRounds; r++) {
    const h = buildHistory(running, playerIds);
    const sitters = pickSitters(playerIds, sitCount, h, r);
    const active = playerIds.filter((id) => !sitters.includes(id));

    const matches = buildAmericanoRoundMatches(active, courtCount, h, r);
    const round: TournamentRound = {
      index: r,
      completed: false,
      matches: toMatchRecord(matches),
      sitOutIds: toIdRecord(sitters),
    };
    rounds.push(round);
    running.push(round);
  }
  return rounds;
}

/** Build one Americano round's matches from active players (best of K tries). */
function buildAmericanoRoundMatches(
  active: string[],
  courtCount: number,
  h: ScheduleHistory,
  roundIndex: number,
): TournamentMatch[] {
  const courts = Math.min(courtCount, Math.floor(active.length / 4));
  let best: TournamentMatch[] = [];
  let bestCost = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 40; attempt++) {
    const order = shuffle(active);
    const matches: TournamentMatch[] = [];
    let cost = 0;
    for (let c = 0; c < courts; c++) {
      const four = order.slice(c * 4, c * 4 + 4);
      const split = bestFourSplit(four, h, 0);
      cost +=
        partnerRepeat(h, split.a1, split.a2) * 3 +
        partnerRepeat(h, split.b1, split.b2) * 3 +
        opponentRepeat(h, split.a1, split.b1) +
        opponentRepeat(h, split.a1, split.b2) +
        opponentRepeat(h, split.a2, split.b1) +
        opponentRepeat(h, split.a2, split.b2);
      matches.push({
        id: `r${roundIndex}_c${c}`,
        courtIndex: c,
        ...split,
      });
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = matches;
      if (cost === 0) break;
    }
  }
  return best;
}

// ── Individual Mexicano / Super Mexicano (dynamic, one round at a time) ───────

/**
 * Generate the next Mexicano round. Round 0 is random; later rounds group
 * players by current standings into courts (court 0 = top four) and pick the
 * split within each court that avoids repeat partners/opponents.
 */
export function generateMexicanoRound(
  playerIds: string[],
  courtCount: number,
  roundIndex: number,
  priorRounds: TournamentRound[],
  standingsOrder: string[],
): TournamentRound {
  const n = playerIds.length;
  const perRound = 4 * Math.min(courtCount, Math.floor(n / 4));
  const sitCount = n - perRound;
  const h = buildHistory(priorRounds, playerIds);

  let ordered: string[];
  if (roundIndex === 0) {
    ordered = shuffle(playerIds);
  } else {
    ordered = [...standingsOrder];
  }

  const sitters = pickSitters(
    ordered,
    sitCount,
    h,
    roundIndex,
    roundIndex === 0 ? undefined : standingsOrder,
  );
  const active = ordered.filter((id) => !sitters.includes(id));

  const courts = Math.min(courtCount, Math.floor(active.length / 4));
  const matches: TournamentMatch[] = [];
  for (let c = 0; c < courts; c++) {
    const four = active.slice(c * 4, c * 4 + 4);
    const split = bestFourSplit(four, h, 2);
    matches.push({ id: `r${roundIndex}_c${c}`, courtIndex: c, ...split });
  }

  return {
    index: roundIndex,
    completed: false,
    matches: toMatchRecord(matches),
    sitOutIds: toIdRecord(sitters),
  };
}

// ── Team Americano (static round-robin) ──────────────────────────────────────

/** Circle-method round-robin producing conflict-free logical rounds of pairs. */
function roundRobinPairs(teamIds: string[]): [string, string][][] {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push('__BYE__');
  const n = ids.length;
  const rounds: [string, string][][] = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== '__BYE__' && b !== '__BYE__') pairs.push([a, b]);
    }
    rounds.push(pairs);
    // rotate keeping first fixed
    arr.splice(1, 0, arr.pop()!);
  }
  return rounds;
}

/**
 * Team Americano: every team plays every other once. Logical RR rounds are
 * split into actual rounds of at most `courtCount` matches (still conflict-free
 * because a logical round never repeats a team). Returns generated rounds.
 */
export function generateTeamAmericanoRounds(
  teamIds: string[],
  teams: Record<string, TournamentTeam>,
  courtCount: number,
): TournamentRound[] {
  const logical = roundRobinPairs(shuffle(teamIds));
  const rounds: TournamentRound[] = [];
  let roundIndex = 0;

  for (const logicalRound of logical) {
    for (let start = 0; start < logicalRound.length; start += courtCount) {
      const chunk = logicalRound.slice(start, start + courtCount);
      const playing = new Set<string>();
      const matches: TournamentMatch[] = chunk.map(([tA, tB], c) => {
        playing.add(tA);
        playing.add(tB);
        const teamA = teams[tA];
        const teamB = teams[tB];
        return {
          id: `r${roundIndex}_c${c}`,
          courtIndex: c,
          teamAId: tA,
          teamBId: tB,
          a1: teamA.p1,
          a2: teamA.p2,
          b1: teamB.p1,
          b2: teamB.p2,
        };
      });
      const sitters = teamIds.filter((t) => !playing.has(t));
      rounds.push({
        index: roundIndex,
        completed: false,
        matches: toMatchRecord(matches),
        sitOutIds: toIdRecord(sitters),
      });
      roundIndex++;
    }
  }
  return rounds;
}

// ── Team Mexicano (dynamic) ──────────────────────────────────────────────────

/**
 * Team Mexicano round: round 0 random, later rounds pair teams by standings
 * (court 0 = top two) while avoiding repeat matchups where possible.
 */
export function generateTeamMexicanoRound(
  teamIds: string[],
  teams: Record<string, TournamentTeam>,
  courtCount: number,
  roundIndex: number,
  priorRounds: TournamentRound[],
  standingsOrder: string[],
): TournamentRound {
  const order = roundIndex === 0 ? shuffle(teamIds) : [...standingsOrder];
  const h = buildHistory(priorRounds, teamIds);

  const maxMatches = Math.min(courtCount, Math.floor(teamIds.length / 2));
  const capacity = maxMatches * 2;
  const sitCount = teamIds.length - capacity;
  const sitters = pickSitters(
    order,
    sitCount,
    h,
    roundIndex,
    roundIndex === 0 ? undefined : standingsOrder,
  );
  const pool = order.filter((t) => !sitters.includes(t));

  // Greedy: take the top remaining team, pair with the best next opponent
  // (fewest prior meetings), preferring adjacency in the standings.
  const remaining = [...pool];
  const matches: TournamentMatch[] = [];
  let c = 0;
  while (remaining.length >= 2) {
    const tA = remaining.shift()!;
    let bestIdx = 0;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const cost = opponentRepeat(h, tA, remaining[i]) * 10 + i;
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }
    const tB = remaining.splice(bestIdx, 1)[0];
    const teamA = teams[tA];
    const teamB = teams[tB];
    matches.push({
      id: `r${roundIndex}_c${c}`,
      courtIndex: c,
      teamAId: tA,
      teamBId: tB,
      a1: teamA.p1,
      a2: teamA.p2,
      b1: teamB.p1,
      b2: teamB.p2,
    });
    c++;
  }

  return {
    index: roundIndex,
    completed: false,
    matches: toMatchRecord(matches),
    sitOutIds: toIdRecord(sitters),
  };
}

// ── King of the Hill ─────────────────────────────────────────────────────────

/** Court occupancy: two pairs per court. */
interface CourtState {
  a: [string, string];
  b: [string, string];
}

/** Read the court states of a completed KotH round (index by courtIndex). */
function readCourts(round: TournamentRound): CourtState[] {
  const matches = Object.values(round.matches ?? {}).sort(
    (m1, m2) => m1.courtIndex - m2.courtIndex,
  );
  return matches.map((m) => ({ a: [m.a1, m.a2], b: [m.b1, m.b2] }));
}

/** Winner side of a KotH match ('a' | 'b'); throws on tie. */
function kothWinnerSide(m: TournamentMatch): 'a' | 'b' {
  const s1 = m.score1 ?? 0;
  const s2 = m.score2 ?? 0;
  if (s1 === s2) throw new Error('err.kothWinner');
  return s1 > s2 ? 'a' : 'b';
}

/** Generate the initial KotH round: courtCount courts of 4, random or seeded. */
export function generateKothInitialRound(
  playerIds: string[],
  courtCount: number,
  seeded: boolean,
): TournamentRound {
  const active = courtCount * 4;
  if (playerIds.length < active) {
    throw new Error('err.kothPlayersGeneric');
  }
  const order = seeded ? [...playerIds] : shuffle(playerIds);
  const sitters = order.slice(active);
  const matches: TournamentMatch[] = [];
  for (let c = 0; c < courtCount; c++) {
    const four = order.slice(c * 4, c * 4 + 4);
    matches.push({
      id: `r0_c${c}`,
      courtIndex: c,
      a1: four[0],
      a2: four[1],
      b1: four[2],
      b2: four[3],
    });
  }
  return {
    index: 0,
    completed: false,
    matches: toMatchRecord(matches),
    sitOutIds: toIdRecord(sitters),
  };
}

/**
 * Build the next KotH round from the just-completed one. Winners move up,
 * losers move down (top winners and bottom losers stay). Every pair splits and
 * plays against its previous partner; the cross-partner combination that best
 * avoids repeats is chosen.
 */
export function generateKothNextRound(
  completed: TournamentRound,
  priorRounds: TournamentRound[],
  roundIndex: number,
  allPlayerIds: string[],
): TournamentRound {
  const courts = readCourts(completed);
  const matches = Object.values(completed.matches ?? {}).sort(
    (m1, m2) => m1.courtIndex - m2.courtIndex,
  );
  const numCourts = matches.length;

  // Winner/loser pair per court.
  const winners: [string, string][] = [];
  const losers: [string, string][] = [];
  matches.forEach((m) => {
    const side = kothWinnerSide(m);
    winners.push(side === 'a' ? [m.a1, m.a2] : [m.b1, m.b2]);
    losers.push(side === 'a' ? [m.b1, m.b2] : [m.a1, m.a2]);
  });

  // Determine the two incoming pairs for each destination court.
  const incoming: [[string, string], [string, string]][] = [];
  for (let c = 0; c < numCourts; c++) {
    let first: [string, string];
    let second: [string, string];
    if (c === 0) {
      first = winners[0]; // King court winners stay
      second = numCourts > 1 ? winners[1] : losers[0];
    } else if (c === numCourts - 1) {
      first = losers[c - 1]; // losers coming down
      second = losers[c]; // bottom losers stay
    } else {
      first = losers[c - 1];
      second = winners[c + 1];
    }
    incoming.push([first, second]);
  }

  const h = buildHistory([...priorRounds, completed], allPlayerIds);

  const newMatches: TournamentMatch[] = incoming.map(([pairX, pairY], c) => {
    // Both combinations make previous partners opponents; pick the better one.
    // Option 1: X0+Y0 vs X1+Y1 ; Option 2: X0+Y1 vs X1+Y0
    const cost1 =
      partnerRepeat(h, pairX[0], pairY[0]) +
      partnerRepeat(h, pairX[1], pairY[1]) +
      opponentRepeat(h, pairX[0], pairX[1]) * 0; // partners always meet
    const cost2 =
      partnerRepeat(h, pairX[0], pairY[1]) +
      partnerRepeat(h, pairX[1], pairY[0]);
    const useFirst = cost1 <= cost2;
    const a1 = pairX[0];
    const a2 = useFirst ? pairY[0] : pairY[1];
    const b1 = pairX[1];
    const b2 = useFirst ? pairY[1] : pairY[0];
    return { id: `r${roundIndex}_c${c}`, courtIndex: c, a1, a2, b1, b2 };
  });

  // Sitters carry over unchanged (KotH keeps the same active roster).
  const sitters = Object.values(completed.sitOutIds ?? {});
  return {
    index: roundIndex,
    completed: false,
    matches: toMatchRecord(newMatches),
    sitOutIds: toIdRecord(sitters),
  };
}

/** Compute per-player KotH stats from all rounds (completed ones counted). */
export function computeKothStats(
  tournament: Tournament,
): Record<string, KothStats> {
  const playerIds = Object.values(tournament.playerIds ?? {});
  const rounds = sortedRounds(tournament);
  const stats: Record<string, KothStats> = {};
  playerIds.forEach((id) => {
    stats[id] = {
      currentCourt: -1,
      lastMovement: 'none',
      highestCourt: Number.MAX_SAFE_INTEGER,
      wins: 0,
      losses: 0,
      kingAppearances: 0,
      kingWins: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };
  });

  const previousCourt: Record<string, number> = {};
  for (const round of rounds) {
    const matches = Object.values(round.matches ?? {});
    for (const m of matches) {
      const court = m.courtIndex;
      const sideA = [m.a1, m.a2];
      const sideB = [m.b1, m.b2];
      const scored = m.score1 !== undefined && m.score2 !== undefined;
      const aWon = (m.score1 ?? 0) > (m.score2 ?? 0);

      for (const id of [...sideA, ...sideB]) {
        const st = stats[id];
        if (!st) continue;
        st.currentCourt = court;
        if (court < st.highestCourt) st.highestCourt = court;
        if (court === 0 && round.completed) st.kingAppearances++;
        // movement vs previous round
        const previous = previousCourt[id];
        if (previous === undefined) st.lastMovement = 'none';
        else if (court < previous) st.lastMovement = 'up';
        else if (court > previous) st.lastMovement = 'down';
        else st.lastMovement = court === 0 ? 'stay-top' : 'stay-bottom';
      }

      if (scored && round.completed) {
        for (const id of sideA) {
          stats[id].pointsFor += m.score1 ?? 0;
          stats[id].pointsAgainst += m.score2 ?? 0;
        }
        for (const id of sideB) {
          stats[id].pointsFor += m.score2 ?? 0;
          stats[id].pointsAgainst += m.score1 ?? 0;
        }
        const winSide = aWon ? sideA : sideB;
        const loseSide = aWon ? sideB : sideA;
        for (const id of winSide) {
          stats[id].wins++;
          if (court === 0) stats[id].kingWins++;
        }
        for (const id of loseSide) stats[id].losses++;
      }

      for (const id of [...sideA, ...sideB]) previousCourt[id] = court;
    }
  }

  // Normalise "never reached" highestCourt.
  Object.values(stats).forEach((s) => {
    if (s.highestCourt === Number.MAX_SAFE_INTEGER) s.highestCourt = -1;
  });
  return stats;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface ScoreValidation {
  valid: boolean;
  /** i18n key describing why the score is invalid. */
  reason?: string;
  /** Interpolation params for the reason key. */
  reasonParams?: Record<string, string | number>;
}

/** Winner of a match: 'a' | 'b' | 'tie' based on primary scores. */
export function matchWinner(m: TournamentMatch): 'a' | 'b' | 'tie' {
  const s1 = m.score1 ?? 0;
  const s2 = m.score2 ?? 0;
  if (s1 === s2) return 'tie';
  return s1 > s2 ? 'a' : 'b';
}

/** Validate a completed score against the scoring config and format. */
export function validateScore(
  score1: number,
  score2: number,
  scoring: ScoringConfig,
  format: TournamentFormat,
): ScoreValidation {
  if (score1 < 0 || score2 < 0) {
    return { valid: false, reason: 'err.negative' };
  }
  const koth = format === 'king-of-the-hill';
  if (koth && score1 === score2) {
    return {
      valid: false,
      reason: 'err.kothTie',
    };
  }

  switch (scoring.method) {
    case 'fixed-points': {
      const total = score1 + score2;
      if (total !== scoring.pointTarget) {
        return {
          valid: false,
          reason: 'err.sumTo',
          reasonParams: { target: scoring.pointTarget },
        };
      }
      return { valid: true };
    }
    case 'first-to': {
      const hi = Math.max(score1, score2);
      const lo = Math.min(score1, score2);
      if (hi < scoring.pointTarget) {
        return {
          valid: false,
          reason: 'err.winnerReach',
          reasonParams: { target: scoring.pointTarget },
        };
      }
      if (scoring.goldenPoint) return { valid: true };
      if (scoring.winByTwo && hi - lo < 2) {
        return { valid: false, reason: 'err.diff2' };
      }
      return { valid: true };
    }
    case 'games-sets':
    case 'timed':
    default:
      // Free-form: only the tie rule (for KotH) applies.
      return { valid: true };
  }
}

// ── Standings ────────────────────────────────────────────────────────────────

function sortedRounds(t: Tournament): TournamentRound[] {
  return Object.values(t.rounds ?? {}).sort((a, b) => a.index - b.index);
}

/** Court bonus for a participant on a court, per the config and round. */
function courtBonus(
  bonus: CourtBonusConfig | undefined,
  courtIndex: number,
  roundIndex: number,
  isWinner: boolean,
): number {
  if (!bonus?.enabled) return 0;
  if (roundIndex + 1 < bonus.startRound) return 0;
  if (bonus.winnersOnly && !isWinner) return 0;
  return bonus.points[String(courtIndex)] ?? 0;
}

/**
 * Compute full standings for a tournament, recomputed from all completed
 * rounds. Works for both individual and team formats.
 */
export function computeStandings(
  tournament: Tournament,
  nameOf: (participantId: string) => string,
): StandingRow[] {
  const team = isTeamFormat(tournament.format);
  const participantIds = team
    ? Object.keys(tournament.teams ?? {}).map((k) => tournament.teams![k].id)
    : Object.values(tournament.playerIds ?? {});

  const rows = new Map<string, StandingRow>();
  const ensure = (id: string): StandingRow => {
    let row = rows.get(id);
    if (!row) {
      row = {
        participantId: id,
        name: nameOf(id),
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        diff: 0,
        bonus: 0,
        matchPoints: 0,
        total: 0,
        sitOuts: 0,
      };
      rows.set(id, row);
    }
    return row;
  };
  participantIds.forEach(ensure);

  // Head-to-head accumulator for tie-breaks.
  const h2h: Record<string, number> = {};
  const addH2h = (winner: string, loser: string) => {
    h2h[`${winner}>${loser}`] = (h2h[`${winner}>${loser}`] ?? 0) + 1;
  };

  for (const round of sortedRounds(tournament)) {
    if (!round.completed) continue;
    for (const id of Object.values(round.sitOutIds ?? {})) ensure(id).sitOuts++;

    for (const m of Object.values(round.matches ?? {})) {
      const s1 = m.score1;
      const s2 = m.score2;
      if (s1 === undefined || s2 === undefined) continue;

      const idA = team ? m.teamAId! : null;
      const idB = team ? m.teamBId! : null;
      const sideA = team ? [idA!] : [m.a1, m.a2];
      const sideB = team ? [idB!] : [m.b1, m.b2];
      const winner = matchWinner(m);

      for (const id of sideA) {
        const r = ensure(id);
        r.played++;
        r.pointsFor += s1;
        r.pointsAgainst += s2;
        r.matchPoints += s1;
        r.bonus += courtBonus(
          tournament.bonus,
          m.courtIndex,
          round.index,
          winner === 'a',
        );
        if (winner === 'a') r.wins++;
        else if (winner === 'b') r.losses++;
        else r.draws++;
      }
      for (const id of sideB) {
        const r = ensure(id);
        r.played++;
        r.pointsFor += s2;
        r.pointsAgainst += s1;
        r.matchPoints += s2;
        r.bonus += courtBonus(
          tournament.bonus,
          m.courtIndex,
          round.index,
          winner === 'b',
        );
        if (winner === 'b') r.wins++;
        else if (winner === 'a') r.losses++;
        else r.draws++;
      }

      if (team) {
        if (winner === 'a') addH2h(idA!, idB!);
        else if (winner === 'b') addH2h(idB!, idA!);
      }
    }
  }

  const list = [...rows.values()];
  list.forEach((r) => {
    r.diff = r.pointsFor - r.pointsAgainst;
    r.total = r.matchPoints + r.bonus;
    r.name = nameOf(r.participantId);
  });

  list.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const ab = h2h[`${a.participantId}>${b.participantId}`] ?? 0;
    const ba = h2h[`${b.participantId}>${a.participantId}`] ?? 0;
    if (ab !== ba) return ba - ab;
    return a.name.localeCompare(b.name);
  });
  return list;
}

/** Standings order (participant ids, best first) for round generation. */
export function standingsOrder(
  tournament: Tournament,
  nameOf: (id: string) => string,
): string[] {
  return computeStandings(tournament, nameOf).map((r) => r.participantId);
}

// ── Record helpers (RTDB-safe) ───────────────────────────────────────────────

export function toMatchRecord(
  matches: TournamentMatch[],
): Record<string, TournamentMatch> {
  const rec: Record<string, TournamentMatch> = {};
  matches.forEach((m) => (rec[m.id] = stripUndefined(m)));
  return rec;
}

export function toIdRecord(ids: string[]): Record<string, string> {
  const rec: Record<string, string> = {};
  ids.forEach((id, i) => (rec[String(i)] = id));
  return rec;
}

/** Firebase rejects `undefined`; drop those keys before writing. */
function stripUndefined(match: TournamentMatch): TournamentMatch {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(match)) {
    if (v !== undefined) out[k] = v;
  }
  return out as unknown as TournamentMatch;
}
