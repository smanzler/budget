export type SplitErrorCode =
  "no_participants" | "duplicate_participant" | "invalid_amount";

export class SplitError extends Error {
  readonly code: SplitErrorCode;

  constructor(code: SplitErrorCode, message: string) {
    super(message);
    this.name = "SplitError";
    this.code = code;
  }
}

export function isSplitError(error: unknown): error is SplitError {
  return error instanceof SplitError;
}

export type SplitShare = {
  userId: string;
  amountMinor: number;
};

/**
 * An even split. The amounts always add up to `totalMinor`.
 *
 * A total that does not divide evenly leaves up to one minor unit per
 * participant. That remainder goes to `paidByUserId`, or to the first
 * participant by id if the payer does not split this expense.
 */
export function splitEqually(
  totalMinor: number,
  participantIds: string[],
  paidByUserId: string,
): SplitShare[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) {
    throw new SplitError(
      "invalid_amount",
      `Expense total ${totalMinor} must be a positive integer number of minor units.`,
    );
  }

  const sorted = [...participantIds].sort();
  const [first] = sorted;

  if (first === undefined) {
    throw new SplitError(
      "no_participants",
      "An expense needs at least one participant.",
    );
  }

  if (new Set(sorted).size !== sorted.length) {
    throw new SplitError(
      "duplicate_participant",
      "A participant appears more than once in the split.",
    );
  }

  const base = Math.floor(totalMinor / sorted.length);
  const remainder = totalMinor - base * sorted.length;
  const absorbs = sorted.includes(paidByUserId) ? paidByUserId : first;

  return sorted.map((userId) => ({
    userId,
    amountMinor: userId === absorbs ? base + remainder : base,
  }));
}
