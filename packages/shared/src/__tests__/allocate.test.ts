import { describe, expect, test } from "vitest";
import { allocate, SplitError } from "../split";

/** Deterministic source. Keeps the fuzz cases repeatable. */
function lcg(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe("allocate", () => {
  test("gives the leftover minor units to the largest remainders first", () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(1001, [1, 1, 1])).toEqual([334, 334, 333]);
  });

  test("splits by weight", () => {
    expect(allocate(10000, [3, 1])).toEqual([7500, 2500]);
    expect(allocate(100, [1, 2, 3])).toEqual([17, 33, 50]);
  });

  test("breaks remainder ties by position, so callers control who rounds up", () => {
    expect(allocate(10, [1, 1, 1, 1])).toEqual([3, 3, 2, 2]);
  });

  test("gives nothing to zero weights", () => {
    expect(allocate(101, [1, 0, 1])).toEqual([51, 0, 50]);
  });

  test("handles a total of zero", () => {
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });

  test("mirrors negative totals", () => {
    expect(allocate(-1000, [1, 1, 1])).toEqual([-334, -333, -333]);
  });

  test("always sums back to the total", () => {
    const random = lcg(42);

    for (let run = 0; run < 500; run += 1) {
      const total = Math.floor(random() * 1_000_000);
      const count = 1 + Math.floor(random() * 8);
      const weights = Array.from({ length: count }, () =>
        Math.floor(random() * 10),
      );

      if (weights.every((weight) => weight === 0)) continue;

      const parts = allocate(total, weights);

      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
      expect(parts.every((part) => part >= 0)).toBe(true);
    }
  });

  test("rejects inputs it cannot allocate exactly", () => {
    expect(() => allocate(10.5, [1])).toThrow(SplitError);
    expect(() => allocate(10, [])).toThrow(SplitError);
    expect(() => allocate(10, [1, -1])).toThrow(SplitError);
    expect(() => allocate(10, [0, 0])).toThrow(SplitError);
    expect(() => allocate(10, [1.5])).toThrow(SplitError);
  });

  test("reports why an allocation was rejected", () => {
    expect(() => allocate(10, [0, 0])).toThrow(
      expect.objectContaining({ code: "zero_weight_total" }),
    );
    expect(() => allocate(10, [])).toThrow(
      expect.objectContaining({ code: "no_participants" }),
    );
    expect(() => allocate(10, [-1])).toThrow(
      expect.objectContaining({ code: "invalid_weight" }),
    );
    expect(() => allocate(Number.MAX_SAFE_INTEGER, [2, 1])).toThrow(
      expect.objectContaining({ code: "invalid_amount" }),
    );
  });
});
