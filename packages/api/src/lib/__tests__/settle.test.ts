import { describe, expect, it } from "vitest";
import { simplifyDebts, type NetBalance } from "../settle";

const alice = "a";
const bob = "b";
const carol = "c";
const dan = "d";

function settle(balances: NetBalance[]) {
  const transfers = simplifyDebts(balances);
  const after = new Map(balances.map((b) => [b.userId, b.netMinor]));

  for (const transfer of transfers) {
    after.set(
      transfer.fromUserId,
      (after.get(transfer.fromUserId) ?? 0) + transfer.amountMinor,
    );
    after.set(
      transfer.toUserId,
      (after.get(transfer.toUserId) ?? 0) - transfer.amountMinor,
    );
  }

  return { transfers, after };
}

describe("simplifyDebts", () => {
  it("has nothing to do for a settled group", () => {
    expect(
      simplifyDebts([
        { userId: alice, netMinor: 0 },
        { userId: bob, netMinor: 0 },
      ]),
    ).toEqual([]);
  });

  it("moves the whole debt in one payment", () => {
    expect(
      simplifyDebts([
        { userId: alice, netMinor: 1000 },
        { userId: bob, netMinor: -1000 },
      ]),
    ).toEqual([{ fromUserId: bob, toUserId: alice, amountMinor: 1000 }]);
  });

  it("clears every balance", () => {
    const { transfers, after } = settle([
      { userId: alice, netMinor: 1500 },
      { userId: bob, netMinor: -400 },
      { userId: carol, netMinor: 900 },
      { userId: dan, netMinor: -2000 },
    ]);

    expect([...after.values()]).toEqual([0, 0, 0, 0]);
    expect(transfers.length).toBeLessThanOrEqual(3);
  });

  it("splits a debtor over two creditors", () => {
    const { transfers } = settle([
      { userId: alice, netMinor: -1000 },
      { userId: bob, netMinor: 600 },
      { userId: carol, netMinor: 400 },
    ]);

    expect(transfers).toEqual([
      { fromUserId: alice, toUserId: bob, amountMinor: 600 },
      { fromUserId: alice, toUserId: carol, amountMinor: 400 },
    ]);
  });

  it("keeps the odd minor unit", () => {
    const { after } = settle([
      { userId: alice, netMinor: 667 },
      { userId: bob, netMinor: -334 },
      { userId: carol, netMinor: -333 },
    ]);

    expect([...after.values()]).toEqual([0, 0, 0]);
  });
});
