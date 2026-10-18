import { DEFAULT_SCORING, type Tournament, type TournamentMatch } from "../models/padel.model";
import { computeAllBadges } from "./badges";

/** One-match-per-round tournament: `scores[i]` is [a1+a2, b1+b2] for round i. */
function tournament(
  id: string,
  createdAt: number,
  sides: { a: [string, string]; b: [string, string] },
  scores: ReadonlyArray<[number, number]>,
): Tournament {
  const rounds: Tournament["rounds"] = {};
  scores.forEach(([score1, score2], index) => {
    const match: TournamentMatch = {
      id: `r${index}`,
      courtIndex: 0,
      a1: sides.a[0],
      a2: sides.a[1],
      b1: sides.b[0],
      b2: sides.b[1],
      score1,
      score2,
    };
    rounds[index] = { index, completed: true, matches: { [match.id]: match } };
  });
  return {
    id,
    name: id,
    format: "americano",
    status: "finished",
    playerIds: { 0: "p1", 1: "p2", 2: "p3", 3: "p4" },
    courtCount: 1,
    totalRounds: scores.length,
    currentRound: scores.length - 1,
    scoring: { ...DEFAULT_SCORING, pointTarget: 24 },
    seeded: false,
    rounds,
    createdAt,
  };
}

const SIDES = { a: ["p1", "p2"] as [string, string], b: ["p3", "p4"] as [string, string] };

describe("computeAllBadges", () => {
  it("awards win and loss streaks across tournaments", () => {
    const badges = computeAllBadges([
      tournament("t2", 2, SIDES, [[13, 11], [13, 11]]),
      tournament("t1", 1, SIDES, [[13, 11], [13, 11], [13, 11]]),
    ]);
    expect(badges.get("p1")?.has("onFire")).toBeTrue();
    expect(badges.get("p3")?.has("coldStreak")).toBeTrue();
    expect(badges.get("p1")?.has("unstoppable")).toBeFalse();
  });

  it("breaks streaks on a draw", () => {
    const badges = computeAllBadges([
      tournament("t1", 1, SIDES, [[13, 11], [13, 11], [12, 12], [13, 11], [13, 11]]),
    ]);
    expect(badges.get("p1")?.has("onFire")).toBeFalse();
  });

  it("awards bagel, bageled and demolition", () => {
    const badges = computeAllBadges([tournament("t1", 1, SIDES, [[24, 0]])]);
    expect(badges.get("p1")?.has("bagel")).toBeTrue();
    expect(badges.get("p1")?.has("demolition")).toBeTrue();
    expect(badges.get("p3")?.has("bageled")).toBeTrue();
  });

  it("awards revenge only after losing the previous meeting", () => {
    const badges = computeAllBadges([
      tournament("t1", 1, SIDES, [[11, 13], [13, 11]]),
    ]);
    expect(badges.get("p1")?.has("revenge")).toBeTrue();
    expect(badges.get("p3")?.has("revenge")).toBeFalse();
  });

  it("gives the biggest-win record to the current holders only", () => {
    const badges = computeAllBadges([
      tournament("t1", 1, SIDES, [[20, 4], [10, 14]]),
    ]);
    expect(badges.get("p1")?.has("biggestWin")).toBeTrue();
    expect(badges.get("p3")?.has("biggestWin")).toBeFalse();
  });

  it("ignores draft tournaments", () => {
    const draft = { ...tournament("t1", 1, SIDES, [[24, 0]]), status: "draft" as const };
    expect(computeAllBadges([draft]).size).toBe(0);
  });
});
