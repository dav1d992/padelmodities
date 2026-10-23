import {
  isTeamFormat,
  type Skillset,
  type Tournament,
} from "../models/padel.model";
import { computeStandings, participantNameOf } from "./tournament-engine";

export type BadgeId =
  | "bagel"
  | "demolition"
  | "wall"
  | "tyrant"
  | "iceCold"
  | "razorsEdge"
  | "soClose"
  | "bageled"
  | "deadEven"
  | "biggestWin"
  | "pointRecord"
  | "ironDefense"
  | "onFire"
  | "unstoppable"
  | "legendary"
  | "unbeaten"
  | "backToBack"
  | "podiumStreak"
  | "rising"
  | "coldStreak"
  | "iceAge"
  | "zeroHero"
  | "phoenix"
  | "streakBreaker"
  | "rollercoaster"
  | "chemistry"
  | "revenge"
  | "kingslayer"
  | "davidVsGoliath"
  | "zeroToHero"
  | "bridesmaid"
  | "woodenSpoon"
  // Skill-based
  | "precisionMachine"
  | "surgeon"
  | "metronome"
  | "vibora"
  | "ninja"
  | "lobMachine"
  | "sniper"
  | "sundayPlayer"
  | "bulldozer"
  | "pinball"
  | "workhorse"
  | "wildShot"
  | "looseCannon"
  | "pillowFight"
  | "oldMan"
  | "glassCannon"
  | "professor"
  | "chessPlayer"
  | "headlessChicken"
  | "roadRunner"
  | "couchPotato"
  | "duracell"
  | "tank"
  | "rookie"
  | "allRounder"
  | "average";

export interface BadgeDef {
  readonly id: BadgeId;
  readonly icon: string;
}

/** Display order; names/descriptions live in i18n under `achievement.{id}.*`. */
export const BADGES: ReadonlyArray<BadgeDef> = [
  { id: "bagel", icon: "🥯" },
  { id: "demolition", icon: "💥" },
  { id: "wall", icon: "🧱" },
  { id: "tyrant", icon: "👑" },
  { id: "iceCold", icon: "🧊" },
  { id: "razorsEdge", icon: "🗡️" },
  { id: "biggestWin", icon: "🏔️" },
  { id: "pointRecord", icon: "📈" },
  { id: "ironDefense", icon: "🛡️" },
  { id: "onFire", icon: "🔥" },
  { id: "unstoppable", icon: "🚀" },
  { id: "legendary", icon: "🌟" },
  { id: "unbeaten", icon: "🦾" },
  { id: "backToBack", icon: "🏆" },
  { id: "podiumStreak", icon: "🥇" },
  { id: "rising", icon: "🪜" },
  { id: "phoenix", icon: "🌅" },
  { id: "streakBreaker", icon: "🔨" },
  { id: "rollercoaster", icon: "🎢" },
  { id: "chemistry", icon: "🧪" },
  { id: "revenge", icon: "😤" },
  { id: "kingslayer", icon: "⚔️" },
  { id: "davidVsGoliath", icon: "🪨" },
  { id: "zeroToHero", icon: "🦸" },
  { id: "soClose", icon: "😩" },
  { id: "bageled", icon: "🍩" },
  { id: "deadEven", icon: "⚖️" },
  { id: "coldStreak", icon: "🥶" },
  { id: "iceAge", icon: "❄️" },
  { id: "zeroHero", icon: "🫥" },
  { id: "bridesmaid", icon: "🥈" },
  { id: "woodenSpoon", icon: "🥄" },
];

/** Skill badges, shown together but derived from the player's current skills. */
export const SKILL_BADGES: ReadonlyArray<BadgeDef> = [
  { id: "precisionMachine", icon: "🎯" },
  { id: "surgeon", icon: "🩺" },
  { id: "metronome", icon: "🎵" },
  { id: "vibora", icon: "🐍" },
  { id: "ninja", icon: "🥷" },
  { id: "lobMachine", icon: "🌈" },
  { id: "sniper", icon: "🎯" },
  { id: "sundayPlayer", icon: "☕" },
  { id: "bulldozer", icon: "🚧" },
  { id: "pinball", icon: "🕹️" },
  { id: "workhorse", icon: "🐴" },
  { id: "wildShot", icon: "🎆" },
  { id: "looseCannon", icon: "💣" },
  { id: "pillowFight", icon: "🛏️" },
  { id: "oldMan", icon: "👴" },
  { id: "glassCannon", icon: "🪟" },
  { id: "professor", icon: "🎓" },
  { id: "chessPlayer", icon: "♟️" },
  { id: "headlessChicken", icon: "🐔" },
  { id: "roadRunner", icon: "💨" },
  { id: "couchPotato", icon: "🛋️" },
  { id: "duracell", icon: "🔋" },
  { id: "tank", icon: "🚜" },
  { id: "rookie", icon: "🌱" },
  { id: "allRounder", icon: "🔷" },
  { id: "average", icon: "⚖️" },
];

const SKILL_LOW = 3;
const SKILL_HIGH = 8;
const PRECISION_CONTROL = 9;

/** Skill badges earned from a player's current skillset (low ≤ 3, high ≥ 8). */
export function computeSkillBadges(skillset: Skillset): ReadonlySet<BadgeId> {
  const { power, agility, stamina, control, strategy } = skillset;
  const hi = (v: number): boolean => v >= SKILL_HIGH;
  const lo = (v: number): boolean => v <= SKILL_LOW;
  const values = [power, agility, stamina, control, strategy];
  const earned = new Set<BadgeId>();
  const add = (id: BadgeId, condition: boolean): void => {
    if (condition) earned.add(id);
  };

  add("precisionMachine", control >= PRECISION_CONTROL);
  add("surgeon", hi(control) && hi(strategy));
  add("metronome", hi(control) && hi(stamina));
  add("vibora", hi(control) && hi(power));
  add("ninja", hi(control) && hi(agility));
  add("lobMachine", hi(control) && lo(power));
  add("sniper", hi(control) && lo(agility));
  add("sundayPlayer", hi(control) && lo(stamina));
  add("bulldozer", lo(control) && hi(power));
  add("pinball", lo(control) && hi(agility));
  add("workhorse", lo(control) && hi(stamina));
  add("wildShot", lo(control) && hi(strategy));
  add("looseCannon", lo(control) && lo(strategy));
  add("pillowFight", lo(control) && lo(power));
  add("oldMan", lo(agility) && lo(stamina));
  add("glassCannon", hi(power) && lo(stamina));
  add("professor", hi(strategy) && lo(power));
  add("chessPlayer", hi(strategy) && lo(agility));
  add("headlessChicken", hi(agility) && lo(strategy));
  add("roadRunner", hi(agility) && lo(power));
  add("couchPotato", lo(power) && lo(stamina));
  add("duracell", hi(stamina) && hi(agility));
  add("tank", hi(power) && hi(stamina));
  add("rookie", lo(control) && lo(strategy));
  add("allRounder", values.every((v) => v >= 7));
  add("average", values.every((v) => v >= 4 && v <= 6));

  return earned;
}

const DEMOLITION_SHARE = 0.8;
const WALL_SHARE = 0.25;
const WALL_RUN = 3;
const TYRANT_SHARE = 0.65;
const TOURNAMENT_MIN_MATCHES = 4;
const ICE_COLD_RUN = 3;
const RAZORS_EDGE_WINS = 5;
const SO_CLOSE_LOSSES = 5;
const DEAD_EVEN_DRAWS = 3;
const ON_FIRE_RUN = 5;
const UNSTOPPABLE_RUN = 10;
const LEGENDARY_RUN = 15;
const COLD_STREAK_RUN = 5;
const ICE_AGE_RUN = 10;
const UNBEATEN_MIN_MATCHES = 3;
const PODIUM_STREAK_RUN = 3;
const RISING_RUN = 5;
const PHOENIX_RUN = 5;
const STREAK_BREAKER_RUN = 5;
const ROLLERCOASTER_RUN = 6;
const CHEMISTRY_MIN_MATCHES = 8;
const CHEMISTRY_WIN_RATE = 0.75;
const GOLIATH_RATING_GAP = 150;
const ZERO_TO_HERO_MIN_FIELD = 6;
const BRIDESMAID_SECONDS = 3;

type Result = "W" | "L" | "D";

interface MatchEntry {
  result: Result;
  pointsFor: number;
  pointsAgainst: number;
  /** False for games & sets, whose scores aren't comparable point totals. */
  pointBased: boolean;
}

interface Finish {
  place: number;
  delta?: number;
}

interface TournamentTally {
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  onePointWins: number;
}

interface PlayerState {
  matches: Array<MatchEntry>;
  partners: Map<string, { played: number; wins: number }>;
  lastResultVsPair: Map<string, Result>;
  winStreak: number;
  finishes: Array<Finish>;
  earned: Set<BadgeId>;
}

interface RecordTrack {
  value: number;
  holders: Set<string>;
}

interface Side {
  players: ReadonlyArray<string>;
  opponents: ReadonlyArray<string>;
  teamId?: string;
  opponentTeamId?: string;
  pointsFor: number;
  pointsAgainst: number;
}

function offerRecord(
  track: RecordTrack,
  value: number,
  ids: ReadonlyArray<string>,
): void {
  if (value > track.value) {
    track.value = value;
    track.holders = new Set(ids);
  } else if (value === track.value) {
    ids.forEach((id) => track.holders.add(id));
  }
}

function longestRun<T>(
  items: ReadonlyArray<T>,
  test: (item: T) => boolean,
): number {
  let best = 0;
  let current = 0;
  for (const item of items) {
    current = test(item) ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

function hasPhoenix(results: ReadonlyArray<Result>): boolean {
  let lossRun = 0;
  let winRun = 0;
  let armed = false;
  for (const r of results) {
    if (r === "W") {
      if (winRun === 0) armed = lossRun >= PHOENIX_RUN;
      winRun++;
      lossRun = 0;
      if (armed && winRun >= PHOENIX_RUN) return true;
    } else if (r === "L") {
      lossRun++;
      winRun = 0;
    } else {
      lossRun = 0;
      winRun = 0;
    }
  }
  return false;
}

function longestAlternation(results: ReadonlyArray<Result>): number {
  let best = 0;
  let current = 0;
  let prev: Result | null = null;
  for (const r of results) {
    if (r === "D") current = 0;
    else current = prev !== null && prev !== "D" && prev !== r ? current + 1 : 1;
    prev = r;
    best = Math.max(best, current);
  }
  return best;
}

/** Ids sharing the highest pre-tournament rating. */
function topRated(ratings: Record<string, number>): Set<string> {
  const values = Object.values(ratings);
  if (values.length === 0) return new Set();
  const max = Math.max(...values);
  return new Set(
    Object.entries(ratings)
      .filter(([, r]) => r === max)
      .map(([id]) => id),
  );
}

function resultOf(pointsFor: number, pointsAgainst: number): Result {
  if (pointsFor === pointsAgainst) return "D";
  return pointsFor > pointsAgainst ? "W" : "L";
}

/**
 * Every player's earned badges, derived from all non-draft tournaments.
 * Streaks run across tournaments in creation order; draws break a streak,
 * sitting out does not. Record badges belong to whoever holds the record now.
 */
export function computeAllBadges(
  tournaments: ReadonlyArray<Tournament>,
): Map<string, ReadonlySet<BadgeId>> {
  const states = new Map<string, PlayerState>();
  const stateOf = (id: string): PlayerState => {
    let state = states.get(id);
    if (!state) {
      state = {
        matches: [],
        partners: new Map(),
        lastResultVsPair: new Map(),
        winStreak: 0,
        finishes: [],
        earned: new Set(),
      };
      states.set(id, state);
    }
    return state;
  };

  const biggestWin: RecordTrack = { value: -Infinity, holders: new Set() };
  const pointRecord: RecordTrack = { value: -Infinity, holders: new Set() };
  // Stored negated so a higher value is always better.
  const ironDefense: RecordTrack = { value: -Infinity, holders: new Set() };

  const ordered = tournaments
    .filter((t) => t.status !== "draft")
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const t of ordered) {
    const team = isTeamFormat(t.format);
    const pointBased = t.scoring.method !== "games-sets";
    const ratingsBefore = t.ratingsBefore ?? {};
    const topSeeds = topRated(ratingsBefore);
    const tallies = new Map<string, TournamentTally>();
    const tallyOf = (id: string): TournamentTally => {
      let tally = tallies.get(id);
      if (!tally) {
        tally = {
          played: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          onePointWins: 0,
        };
        tallies.set(id, tally);
      }
      return tally;
    };

    const sideRating = (
      players: ReadonlyArray<string>,
      teamId: string | undefined,
    ): number | null => {
      if (team) return teamId ? (ratingsBefore[teamId] ?? null) : null;
      const [p1, p2] = players.map((id) => ratingsBefore[id]);
      return p1 === undefined || p2 === undefined ? null : (p1 + p2) / 2;
    };

    const rounds = Object.values(t.rounds ?? {})
      .filter((r) => r.completed)
      .sort((a, b) => a.index - b.index);

    for (const round of rounds) {
      for (const m of Object.values(round.matches ?? {})) {
        if (m.score1 === undefined || m.score2 === undefined) continue;
        const sides: Array<Side> = [
          {
            players: [m.a1, m.a2],
            opponents: [m.b1, m.b2],
            teamId: m.teamAId,
            opponentTeamId: m.teamBId,
            pointsFor: m.score1,
            pointsAgainst: m.score2,
          },
          {
            players: [m.b1, m.b2],
            opponents: [m.a1, m.a2],
            teamId: m.teamBId,
            opponentTeamId: m.teamAId,
            pointsFor: m.score2,
            pointsAgainst: m.score1,
          },
        ];
        // Read streaks before this match updates them.
        const streakBefore = new Map(
          [m.a1, m.a2, m.b1, m.b2].map((id) => [id, stateOf(id).winStreak]),
        );

        for (const side of sides) {
          const result = resultOf(side.pointsFor, side.pointsAgainst);
          const total = side.pointsFor + side.pointsAgainst;
          const margin = side.pointsFor - side.pointsAgainst;
          const share = total > 0 ? side.pointsFor / total : 0.5;
          const pairKey = [...side.opponents].sort().join("|");
          const ownRating = sideRating(side.players, side.teamId);
          const oppRating = sideRating(side.opponents, side.opponentTeamId);
          const beatTopSeed = team
            ? side.opponentTeamId !== undefined &&
              topSeeds.has(side.opponentTeamId)
            : side.opponents.some((id) => topSeeds.has(id));

          side.players.forEach((id, i) => {
            const state = stateOf(id);
            state.matches.push({
              result,
              pointsFor: side.pointsFor,
              pointsAgainst: side.pointsAgainst,
              pointBased,
            });

            const partnerId = side.players[1 - i] ?? "";
            const partner = state.partners.get(partnerId) ?? {
              played: 0,
              wins: 0,
            };
            partner.played++;
            if (result === "W") partner.wins++;
            state.partners.set(partnerId, partner);

            const previous = state.lastResultVsPair.get(pairKey);
            state.lastResultVsPair.set(pairKey, result);

            const tally = tallyOf(id);
            tally.played++;
            tally.pointsFor += side.pointsFor;
            tally.pointsAgainst += side.pointsAgainst;
            if (result === "W") tally.wins++;
            if (result === "L") tally.losses++;

            if (result === "W") {
              if (previous === "L") state.earned.add("revenge");
              if (beatTopSeed) state.earned.add("kingslayer");
              if (
                side.opponents.some(
                  (opp) => (streakBefore.get(opp) ?? 0) >= STREAK_BREAKER_RUN,
                )
              ) {
                state.earned.add("streakBreaker");
              }
              if (
                ownRating !== null &&
                oppRating !== null &&
                oppRating - ownRating >= GOLIATH_RATING_GAP
              ) {
                state.earned.add("davidVsGoliath");
              }
            }

            if (!pointBased) return;
            if (result === "W" && side.pointsAgainst === 0)
              state.earned.add("bagel");
            if (result === "L" && side.pointsFor === 0)
              state.earned.add("bageled");
            if (result === "W" && share >= DEMOLITION_SHARE)
              state.earned.add("demolition");
            if (result === "W" && margin === 1) tally.onePointWins++;
          });

          if (pointBased && result === "W") {
            offerRecord(biggestWin, margin, side.players);
          }
        }

        for (const side of sides) {
          const won = side.pointsFor > side.pointsAgainst;
          side.players.forEach((id) => {
            const state = stateOf(id);
            state.winStreak = won ? state.winStreak + 1 : 0;
          });
        }
      }
    }

    tallies.forEach((tally, id) => {
      if (pointBased && tally.onePointWins >= RAZORS_EDGE_WINS) {
        stateOf(id).earned.add("razorsEdge");
      }
    });

    if (t.status !== "finished") continue;

    tallies.forEach((tally, id) => {
      const state = stateOf(id);
      if (tally.played >= UNBEATEN_MIN_MATCHES) {
        if (tally.losses === 0) state.earned.add("unbeaten");
        if (tally.wins === 0) state.earned.add("zeroHero");
      }
      if (!pointBased) return;
      offerRecord(pointRecord, tally.pointsFor, [id]);
      const total = tally.pointsFor + tally.pointsAgainst;
      if (tally.played >= TOURNAMENT_MIN_MATCHES && total > 0) {
        if (tally.pointsFor / total >= TYRANT_SHARE) state.earned.add("tyrant");
        offerRecord(ironDefense, -tally.pointsAgainst / total, [id]);
      }
    });

    const nameOf = (id: string): string => participantNameOf(t, id);
    const standings = computeStandings(t, nameOf);
    if (standings.length < 2) continue;

    const teams = Object.values(t.teams ?? {});
    const playersOf = (participantId: string): ReadonlyArray<string> => {
      if (!team) return [participantId];
      const found = teams.find((x) => x.id === participantId);
      return found ? [found.p1, found.p2] : [];
    };
    const placeOf = new Map(
      standings.map((row, i) => [row.participantId, i + 1]),
    );

    standings.forEach((row, i) => {
      const place = i + 1;
      const delta = t.ratingDeltas?.[row.participantId];
      for (const id of playersOf(row.participantId)) {
        const state = stateOf(id);
        state.finishes.push({ place, delta });
        if (place === standings.length) state.earned.add("woodenSpoon");
      }
    });

    const firstRound = rounds[0];
    if (firstRound && standings.length >= ZERO_TO_HERO_MIN_FIELD) {
      const afterFirst = computeStandings(
        { ...t, rounds: { [firstRound.index]: firstRound } },
        nameOf,
      ).filter((row) => row.played > 0);
      const lowest = Math.min(...afterFirst.map((row) => row.total));
      afterFirst
        .filter(
          (row) =>
            row.total === lowest &&
            (placeOf.get(row.participantId) ?? Infinity) <= 3,
        )
        .forEach((row) =>
          playersOf(row.participantId).forEach((id) =>
            stateOf(id).earned.add("zeroToHero"),
          ),
        );
    }
  }

  states.forEach((state) => {
    const results = state.matches.map((m) => m.result);
    const pointMatches = state.matches.filter((m) => m.pointBased);
    const earn = (id: BadgeId, condition: boolean): void => {
      if (condition) state.earned.add(id);
    };

    const winRun = longestRun(results, (r) => r === "W");
    const lossRun = longestRun(results, (r) => r === "L");
    earn("onFire", winRun >= ON_FIRE_RUN);
    earn("unstoppable", winRun >= UNSTOPPABLE_RUN);
    earn("legendary", winRun >= LEGENDARY_RUN);
    earn("coldStreak", lossRun >= COLD_STREAK_RUN);
    earn("iceAge", lossRun >= ICE_AGE_RUN);
    earn("phoenix", hasPhoenix(results));
    earn("rollercoaster", longestAlternation(results) >= ROLLERCOASTER_RUN);
    earn("deadEven", results.filter((r) => r === "D").length >= DEAD_EVEN_DRAWS);

    earn(
      "wall",
      longestRun(
        pointMatches,
        (m) =>
          m.pointsFor + m.pointsAgainst > 0 &&
          m.pointsAgainst / (m.pointsFor + m.pointsAgainst) < WALL_SHARE,
      ) >= WALL_RUN,
    );
    earn(
      "iceCold",
      longestRun(pointMatches, (m) => m.pointsFor - m.pointsAgainst === 1) >=
        ICE_COLD_RUN,
    );
    earn(
      "soClose",
      pointMatches.filter((m) => m.pointsAgainst - m.pointsFor === 1).length >=
        SO_CLOSE_LOSSES,
    );

    earn(
      "chemistry",
      [...state.partners.values()].some(
        (p) =>
          p.played >= CHEMISTRY_MIN_MATCHES &&
          p.wins / p.played >= CHEMISTRY_WIN_RATE,
      ),
    );

    earn("backToBack", longestRun(state.finishes, (f) => f.place === 1) >= 2);
    earn(
      "podiumStreak",
      longestRun(state.finishes, (f) => f.place <= 3) >= PODIUM_STREAK_RUN,
    );
    earn(
      "rising",
      longestRun(state.finishes, (f) => (f.delta ?? 0) > 0) >= RISING_RUN,
    );
    earn(
      "bridesmaid",
      state.finishes.filter((f) => f.place === 2).length >= BRIDESMAID_SECONDS,
    );
  });

  const awardRecord = (track: RecordTrack, id: BadgeId): void => {
    track.holders.forEach((holder) => stateOf(holder).earned.add(id));
  };
  awardRecord(biggestWin, "biggestWin");
  awardRecord(pointRecord, "pointRecord");
  awardRecord(ironDefense, "ironDefense");

  const result = new Map<string, ReadonlySet<BadgeId>>();
  states.forEach((state, id) => result.set(id, state.earned));
  return result;
}
