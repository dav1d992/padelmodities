import { DEFAULT_SCORING, type Tournament } from "../models/padel.model";
import {
  completeCurrentRound,
  generateBeatTheBoxInitialRound,
  generateBeatTheBoxNextRound,
  validateScore,
} from "./tournament-engine";

function playerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index}`);
}

function makeTournament(playerCount: number, totalRounds = 3): Tournament {
  const playerMap = Object.fromEntries(
    playerIds(playerCount).map((id, index) => [String(index), id]),
  );
  return {
    id: "box",
    name: "Beat the Box",
    format: "beat-the-box",
    status: "active",
    playerIds: playerMap,
    courtCount: 2,
    totalRounds,
    currentRound: 0,
    scoring: { ...DEFAULT_SCORING },
    seeded: true,
    createdAt: 0,
  };
}

function scoreRound(
  round: ReturnType<typeof generateBeatTheBoxInitialRound>,
  scoreByCourt: Record<number, [number, number]>,
) {
  return {
    ...round,
    completed: true,
    matches: Object.fromEntries(
      Object.values(round.matches ?? {}).map((match) => {
        const [score1, score2] = scoreByCourt[match.courtIndex];
        return [match.id, { ...match, score1, score2 }];
      }),
    ),
  };
}

describe("Beat the Box", () => {
  it("splits high ELO seeds across courts in a snake pattern", () => {
    const rankedPlayers = ["p7", "p6", "p5", "p4", "p3", "p2", "p1", "p0"];
    const round = generateBeatTheBoxInitialRound(rankedPlayers, 2, true);
    const matches = Object.values(round.matches ?? {}).sort(
      (a, b) => a.courtIndex - b.courtIndex,
    );

    expect(
      matches.map((match) => [match.a1, match.a2, match.b1, match.b2].sort()),
    ).toEqual([
      ["p0", "p3", "p4", "p7"],
      ["p1", "p2", "p5", "p6"],
    ]);
  });

  it("plays all three possible partners within a box", () => {
    const ids = playerIds(4);
    const round0 = generateBeatTheBoxInitialRound(ids, 1, true);
    const round1 = generateBeatTheBoxNextRound(round0, [round0], 1, ids, 1);
    const round2 = generateBeatTheBoxNextRound(
      round1,
      [round0, round1],
      2,
      ids,
      1,
    );
    const partnerByPlayer = new Map(ids.map((id) => [id, new Set<string>()]));

    for (const round of [round0, round1, round2]) {
      const match = Object.values(round.matches ?? {})[0];
      partnerByPlayer.get(match.a1)?.add(match.a2);
      partnerByPlayer.get(match.a2)?.add(match.a1);
      partnerByPlayer.get(match.b1)?.add(match.b2);
      partnerByPlayer.get(match.b2)?.add(match.b1);
    }

    for (const id of ids) {
      expect(partnerByPlayer.get(id)?.size).toBe(3);
    }
  });

  it("moves the top two from each box into the upper box after three rounds", () => {
    const ids = playerIds(8);
    const round0 = generateBeatTheBoxInitialRound(ids, 2, true);
    const first = scoreRound(round0, { 0: [16, 8], 1: [16, 8] });
    const round1 = generateBeatTheBoxNextRound(first, [first], 1, ids, 2);
    const second = scoreRound(round1, { 0: [12, 12], 1: [12, 12] });
    const round2 = generateBeatTheBoxNextRound(
      second,
      [first, second],
      2,
      ids,
      2,
    );
    const third = scoreRound(round2, { 0: [20, 4], 1: [20, 4] });
    const next = generateBeatTheBoxNextRound(
      third,
      [first, second, third],
      3,
      ids,
      2,
    );
    const boxes = Object.values(next.matches ?? {})
      .sort((a, b) => a.courtIndex - b.courtIndex)
      .map((match) => [match.a1, match.a2, match.b1, match.b2].sort());

    expect(boxes).toEqual([
      ["p0", "p1", "p6", "p7"],
      ["p2", "p3", "p4", "p5"],
    ]);
  });

  it("advances through each pairing round before regrouping", () => {
    const tournament = makeTournament(4, 6);
    const initialRound = generateBeatTheBoxInitialRound(
      playerIds(4),
      tournament.courtCount,
      true,
    );
    const scoredRound = scoreRound(initialRound, { 0: [12, 12] });
    const initial = {
      ...tournament,
      rounds: {
        "0": { ...scoredRound, completed: false },
      },
    };
    const advanced = completeCurrentRound(initial);
    const nextMatches = Object.values(advanced.rounds?.["1"]?.matches ?? {});

    expect(advanced.currentRound).toBe(1);
    expect(nextMatches[0]).toEqual(
      jasmine.objectContaining({
        a1: "p0",
        a2: "p2",
        b1: "p1",
        b2: "p3",
      }),
    );
  });

  it("rotates excess players into boxes without creating three-player boxes", () => {
    const ids = playerIds(10);
    const round0 = generateBeatTheBoxInitialRound(ids, 2, true);
    const first = scoreRound(round0, { 0: [24, 0], 1: [24, 0] });
    const round1 = generateBeatTheBoxNextRound(first, [first], 1, ids, 2);
    const second = scoreRound(round1, { 0: [0, 24], 1: [0, 24] });
    const round2 = generateBeatTheBoxNextRound(
      second,
      [first, second],
      2,
      ids,
      2,
    );
    const third = scoreRound(round2, { 0: [24, 0], 1: [24, 0] });
    const next = generateBeatTheBoxNextRound(
      third,
      [first, second, third],
      3,
      ids,
      2,
    );
    const active = Object.values(next.matches ?? {}).flatMap((match) => [
      match.a1,
      match.a2,
      match.b1,
      match.b2,
    ]);

    expect(active).toHaveSize(8);
    expect(Object.values(next.sitOutIds ?? {})).toHaveSize(2);
    expect(active).toContain("p8");
  });

  it("allows tied scores because placement uses total points", () => {
    const result = validateScore(
      12,
      12,
      { ...DEFAULT_SCORING },
      "beat-the-box",
    );

    expect(result.valid).toBe(true);
  });
});
