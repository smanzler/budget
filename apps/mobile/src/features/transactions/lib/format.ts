import { formatCurrency } from "@/lib/utils";

export type FormattedAmount = {
  text: string;
  /** Money came *in* — a refund, payment, or deposit. */
  isInflow: boolean;
};

/**
 * The only module allowed to interpret Plaid's sign convention.
 *
 * Rows are stored verbatim from Plaid, where a **positive** amount means money
 * **left** the account. Everywhere else in the app, ask this function.
 *
 * Outflows render bare (`$12.34`) because a card ledger is ~95% debits and
 * signing all of them is noise; inflows get an explicit `+` and, at the call
 * site, the one bit of color on the row.
 */
export const formatTransactionAmount = (
  amount: string,
  currency?: string | null,
): FormattedAmount => {
  // `Number("")` is 0, so an empty string would silently render as $0.00.
  const value = amount.trim() === "" ? NaN : Number(amount);

  if (!Number.isFinite(value)) return { text: "—", isInflow: false };

  const isInflow = value < 0;

  return {
    text: `${isInflow ? "+" : ""}${formatCurrency(Math.abs(value), currency)}`,
    isInflow,
  };
};

/** `Chase Sapphire •••• 4242` — the subtitle for an account row. */
export const formatAccountLabel = (
  name: string,
  mask?: string | null,
): string => (mask ? `${name} •••• ${mask}` : name);

/** `FOOD_AND_DRINK` → `Food and drink`. */
export const formatCategory = (category?: string | null): string | null => {
  if (!category) return null;

  const words = category.toLowerCase().split("_");
  const [first, ...rest] = words;
  if (!first) return null;

  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
};
