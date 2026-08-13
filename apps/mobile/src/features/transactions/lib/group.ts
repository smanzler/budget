import type { RouterOutputs } from "@/lib/trpc";

export type Transaction =
  RouterOutputs["transactions"]["list"]["items"][number];

export type TransactionSection = {
  /** The raw `YYYY-MM-DD`, used as the section key. */
  date: string;
  title: string;
  /** Net for the day, in Plaid's convention: positive means money went out. */
  total: number;
  currency: string | null;
  data: Transaction[];
};

const MS_PER_DAY = 86_400_000;

/**
 * `new Date("2026-08-13")` parses as **UTC** midnight. In any UTC-negative zone
 * that is yesterday evening locally, which is how a naive implementation files
 * this evening's transactions under "Yesterday". Parse the parts by hand.
 */
const parseLocalDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Today / Yesterday / weekday / `Mon D`.
 *
 * Deliberately not `lib/utils.ts:formatDate`, which floors elapsed milliseconds
 * — across a DST boundary a "day" is 23 or 25 hours and flooring lands on the
 * wrong label. Rounding the delta between two local midnights doesn't care.
 *
 * Weekday names rather than "N days ago" because a sticky header would
 * otherwise re-label itself as the list ages.
 */
export const formatDayHeading = (date: string, now = new Date()): string => {
  const parsed = parseLocalDate(date);
  if (!parsed) return date;

  const delta = Math.round(
    (startOfDay(now).getTime() - startOfDay(parsed).getTime()) / MS_PER_DAY,
  );

  if (delta === 0) return "Today";
  if (delta === 1) return "Yesterday";

  if (delta > 1 && delta < 7) {
    return parsed.toLocaleDateString("en-US", { weekday: "long" });
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(parsed.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
};

/**
 * Groups an already date-descending list into day sections.
 *
 * Runs over the *flattened* pages so a day straddling a page boundary merges
 * into one section instead of appearing twice. Never mutates the input — those
 * arrays are the TanStack Query cache.
 */
export const groupByDay = (
  transactions: Transaction[],
  now = new Date(),
): TransactionSection[] => {
  const sections = new Map<string, TransactionSection>();
  // Summed in integer cents: adding 100 floats drifts into visible pennies.
  const cents = new Map<string, number>();

  for (const transaction of transactions) {
    let section = sections.get(transaction.date);

    if (!section) {
      section = {
        date: transaction.date,
        title: formatDayHeading(transaction.date, now),
        total: 0,
        currency: transaction.isoCurrencyCode,
        data: [],
      };
      sections.set(transaction.date, section);
      cents.set(transaction.date, 0);
    }

    section.data.push(transaction);
    section.currency ??= transaction.isoCurrencyCode;

    const value = Number(transaction.amount);
    if (Number.isFinite(value)) {
      cents.set(
        transaction.date,
        (cents.get(transaction.date) ?? 0) + Math.round(value * 100),
      );
    }
  }

  for (const section of sections.values()) {
    section.total = (cents.get(section.date) ?? 0) / 100;
  }

  // Map preserves insertion order, and the input arrives date-descending.
  return [...sections.values()];
};
