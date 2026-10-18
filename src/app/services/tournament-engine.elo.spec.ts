import {
  breakEvenPlacements,
  expectedPlacements,
  placementEloDeltas,
} from "./tournament-engine";

describe("placementEloDeltas", () => {
  it("returns zero for fewer than two participants", () => {
    expect(placementEloDeltas([], 32)).toEqual([]);
    expect(placementEloDeltas([1000], 32)).toEqual([0]);
  });

  it("spreads an equal field symmetrically", () => {
    expect(placementEloDeltas(Array(8).fill(1000), 32)).toEqual([
      16, 11, 7, 2, -2, -7, -11, -16,
    ]);
  });

  it("rewards winning against a stronger field", () => {
    const [vsEqual] = placementEloDeltas([1000, ...Array(7).fill(1000)], 32);
    const [vsStronger] = placementEloDeltas([1000, ...Array(7).fill(1200)], 32);
    const [asFavourite] = placementEloDeltas([1200, ...Array(7).fill(1000)], 32);
    expect(vsStronger).toBeGreaterThan(vsEqual);
    expect(asFavourite).toBeLessThan(vsEqual);
  });

  it("is zero-sum before rounding", () => {
    const deltas = placementEloDeltas([950, 1210, 1000, 1080, 870, 1150], 1000);
    const sum = deltas.reduce((s, d) => s + d, 0);
    expect(Math.abs(sum)).toBeLessThanOrEqual(deltas.length);
  });
});

describe("expectedPlacements", () => {
  it("ranks by rating, highest first", () => {
    expect(expectedPlacements([1000, 1200, 800])).toEqual([
      { from: 2, to: 2 },
      { from: 1, to: 1 },
      { from: 3, to: 3 },
    ]);
  });

  it("gives tied ratings a shared range", () => {
    expect(expectedPlacements([1000, 1100, 1000, 900])).toEqual([
      { from: 2, to: 3 },
      { from: 1, to: 1 },
      { from: 2, to: 3 },
      { from: 4, to: 4 },
    ]);
  });
});

describe("breakEvenPlacements", () => {
  it("is the last place that does not lose Elo", () => {
    const ratings = [950, ...Array(15).fill(1000)];
    const [place] = breakEvenPlacements(ratings);
    const deltaAt = (p: number): number => {
      const order = ratings.slice(1);
      order.splice(p - 1, 0, ratings[0]);
      return placementEloDeltas(order, 1000)[p - 1];
    };
    expect(deltaAt(place)).toBeGreaterThanOrEqual(0);
    expect(deltaAt(place + 1)).toBeLessThan(0);
  });

  it("puts an equal field at the middle", () => {
    expect(breakEvenPlacements(Array(16).fill(1000))).toEqual(
      Array(16).fill(8),
    );
  });
});
