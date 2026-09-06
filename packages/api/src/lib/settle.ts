export type NetBalance = {
  userId: string;
  netMinor: number;
};

/** `fromUserId` pays `toUserId`. `amountMinor` is always above zero. */
export type Transfer = {
  fromUserId: string;
  toUserId: string;
  amountMinor: number;
};

/**
 * The fewest payments that bring every balance to zero. The balances must add
 * up to zero.
 *
 * The plan matches the largest debtor to the largest creditor, so it can ask a
 * user to pay a user they never shared an expense with.
 */
export function simplifyDebts(balances: NetBalance[]): Transfer[] {
  const byLargest = (a: NetBalance, b: NetBalance) =>
    Math.abs(b.netMinor) - Math.abs(a.netMinor) ||
    a.userId.localeCompare(b.userId);

  const creditors = balances.filter((b) => b.netMinor > 0).sort(byLargest);
  const debtors = balances.filter((b) => b.netMinor < 0).sort(byLargest);

  const transfers: Transfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  let credit = creditors[0]?.netMinor ?? 0;
  let debt = -(debtors[0]?.netMinor ?? 0);

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];

    if (!creditor || !debtor) break;

    const amountMinor = Math.min(credit, debt);

    if (amountMinor > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amountMinor,
      });
    }

    credit -= amountMinor;
    debt -= amountMinor;

    if (credit === 0) {
      creditorIndex += 1;
      credit = creditors[creditorIndex]?.netMinor ?? 0;
    }

    if (debt === 0) {
      debtorIndex += 1;
      debt = -(debtors[debtorIndex]?.netMinor ?? 0);
    }
  }

  return transfers;
}
