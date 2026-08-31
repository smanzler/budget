export type SplitErrorCode =
  | "no_participants"
  | "duplicate_participant"
  | "invalid_amount"
  | "invalid_weight"
  | "zero_weight_total";

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
 * The parts always add up to `totalMinor`. Each weight must be a non-negative
 * integer, and at least one weight must be more than zero.
 *
 * Give the weights in a stable order: a leftover minor unit goes to the largest
 * remainder, then to the lowest index.
 */
export function allocate(totalMinor: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(totalMinor)) {
    throw new SplitError(
      "invalid_amount",
      `Amount ${totalMinor} must be an integer number of minor units.`,
    );
  }

  if (weights.length === 0) {
    throw new SplitError(
      "no_participants",
      "Nothing to allocate the amount to.",
    );
  }

  let weightTotal = 0;

  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new SplitError(
        "invalid_weight",
        `Weight ${weight} must be a non-negative integer.`,
      );
    }
    weightTotal += weight;
  }

  if (weightTotal === 0) {
    throw new SplitError(
      "zero_weight_total",
      "At least one participant must have a non-zero share.",
    );
  }

  const sign = totalMinor < 0 ? -1 : 1;
  const magnitude = Math.abs(totalMinor);

  const parts: number[] = [];
  const remainders: { index: number; remainder: number }[] = [];
  let assigned = 0;

  weights.forEach((weight, index) => {
    const exact = magnitude * weight;

    if (!Number.isSafeInteger(exact)) {
      throw new SplitError(
        "invalid_amount",
        "Amount and weights are too large to allocate exactly.",
      );
    }

    const part = Math.floor(exact / weightTotal);

    parts.push(part);
    assigned += part;
    remainders.push({ index, remainder: exact - part * weightTotal });
  });

  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  let leftover = magnitude - assigned;

  for (const { index } of remainders) {
    if (leftover <= 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    leftover -= 1;
  }

  return sign === 1 ? parts : parts.map((part) => -part);
}

/**
 * An even split. The odd minor units go to the users that sort first by id, so
 * the result does not change with the order of `participantIds`.
 */
export function splitEqually(
  totalMinor: number,
  participantIds: string[],
): SplitShare[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) {
    throw new SplitError(
      "invalid_amount",
      `Expense total ${totalMinor} must be a positive integer number of minor units.`,
    );
  }

  const seen = new Set<string>();

  for (const id of participantIds) {
    if (seen.has(id)) {
      throw new SplitError(
        "duplicate_participant",
        `Participant ${id} appears more than once in the split.`,
      );
    }
    seen.add(id);
  }

  const sorted = [...participantIds].sort();
  const amounts = allocate(
    totalMinor,
    sorted.map(() => 1),
  );

  return sorted.map((userId, index) => ({
    userId,
    amountMinor: amounts[index] ?? 0,
  }));
}
