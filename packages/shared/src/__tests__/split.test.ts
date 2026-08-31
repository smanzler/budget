import { describe, expect, test } from "vitest";
import { splitEqually, SplitError } from "../split";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const CAROL = "33333333-3333-4333-8333-333333333333";

describe("splitEqually", () => {
  test("hands the odd minor units out in user-id order", () => {
    expect(splitEqually(1000, [CAROL, ALICE, BOB])).toEqual([
      { userId: ALICE, amountMinor: 334 },
      { userId: BOB, amountMinor: 333 },
      { userId: CAROL, amountMinor: 333 },
    ]);
  });

  test("is independent of the order the client listed participants in", () => {
    expect(splitEqually(1000, [ALICE, BOB, CAROL])).toEqual(
      splitEqually(1000, [BOB, CAROL, ALICE]),
    );
  });

  test("gives a single participant the whole total", () => {
    expect(splitEqually(1000, [ALICE])).toEqual([
      { userId: ALICE, amountMinor: 1000 },
    ]);
  });

  test("shares always add up to the expense total", () => {
    for (let total = 1; total <= 300; total += 1) {
      const shares = splitEqually(total, [ALICE, BOB, CAROL]);

      const sum = shares.reduce(
        (running, share) => running + share.amountMinor,
        0,
      );

      expect(sum).toBe(total);
    }
  });

  test("rejects totals that are not a positive whole number of minor units", () => {
    expect(() => splitEqually(0, [ALICE])).toThrow(SplitError);
    expect(() => splitEqually(-100, [ALICE])).toThrow(SplitError);
    expect(() => splitEqually(10.5, [ALICE])).toThrow(SplitError);
  });

  test("rejects an empty participant list", () => {
    expect(() => splitEqually(1000, [])).toThrow(
      expect.objectContaining({ code: "no_participants" }),
    );
  });

  test("rejects a participant listed twice", () => {
    expect(() => splitEqually(1000, [ALICE, ALICE])).toThrow(
      expect.objectContaining({ code: "duplicate_participant" }),
    );
  });
});
