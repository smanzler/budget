import { describe, expect, test } from "vitest";
import { splitEqually, SplitError } from "../split";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const CAROL = "33333333-3333-4333-8333-333333333333";
const DAVE = "44444444-4444-4444-8444-444444444444";

describe("splitEqually", () => {
  test("divides a total that splits evenly", () => {
    expect(splitEqually(900, [ALICE, BOB, CAROL], ALICE)).toEqual([
      { userId: ALICE, amountMinor: 300 },
      { userId: BOB, amountMinor: 300 },
      { userId: CAROL, amountMinor: 300 },
    ]);
  });

  test("gives the remainder to the payer", () => {
    expect(splitEqually(1000, [ALICE, BOB, CAROL], BOB)).toEqual([
      { userId: ALICE, amountMinor: 333 },
      { userId: BOB, amountMinor: 334 },
      { userId: CAROL, amountMinor: 333 },
    ]);
  });

  test("gives the payer every leftover minor unit", () => {
    expect(splitEqually(1002, [ALICE, BOB, CAROL, DAVE], CAROL)).toEqual([
      { userId: ALICE, amountMinor: 250 },
      { userId: BOB, amountMinor: 250 },
      { userId: CAROL, amountMinor: 252 },
      { userId: DAVE, amountMinor: 250 },
    ]);
  });

  test("gives the remainder to the first participant by id when the payer is not splitting", () => {
    expect(splitEqually(1001, [CAROL, BOB], DAVE)).toEqual([
      { userId: BOB, amountMinor: 501 },
      { userId: CAROL, amountMinor: 500 },
    ]);
  });

  test("is independent of the order the client listed participants in", () => {
    expect(splitEqually(1000, [ALICE, BOB, CAROL], BOB)).toEqual(
      splitEqually(1000, [CAROL, ALICE, BOB], BOB),
    );
  });

  test("gives a single participant the whole total", () => {
    expect(splitEqually(1000, [ALICE], ALICE)).toEqual([
      { userId: ALICE, amountMinor: 1000 },
    ]);
  });

  test("shares always add up to the expense total", () => {
    for (let total = 1; total <= 300; total += 1) {
      const shares = splitEqually(total, [ALICE, BOB, CAROL], BOB);
      const sum = shares.reduce(
        (running, share) => running + share.amountMinor,
        0,
      );

      expect(sum).toBe(total);
    }
  });

  test("keeps every other participant on the same amount", () => {
    for (let total = 1; total <= 300; total += 1) {
      const others = splitEqually(total, [ALICE, BOB, CAROL, DAVE], BOB)
        .filter((share) => share.userId !== BOB)
        .map((share) => share.amountMinor);

      expect(new Set(others).size).toBe(1);
    }
  });

  test("rejects totals that are not a positive whole number of minor units", () => {
    expect(() => splitEqually(0, [ALICE], ALICE)).toThrow(SplitError);
    expect(() => splitEqually(-100, [ALICE], ALICE)).toThrow(SplitError);
    expect(() => splitEqually(10.5, [ALICE], ALICE)).toThrow(SplitError);
  });

  test("rejects an empty participant list", () => {
    expect(() => splitEqually(1000, [], ALICE)).toThrow(
      expect.objectContaining({ code: "no_participants" }),
    );
  });

  test("rejects a participant listed twice", () => {
    expect(() => splitEqually(1000, [ALICE, ALICE], ALICE)).toThrow(
      expect.objectContaining({ code: "duplicate_participant" }),
    );
  });
});
