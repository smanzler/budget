import { z } from "zod";

/**
 * A group fixes one currency for all of its expenses, so this list is what the
 * create-group picker offers and what the API accepts. Keeping it curated (and
 * shared) means the client can't offer a currency the API would reject.
 */
export const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
export type CurrencyCode = Currency["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export const currencyCodeSchema = z.enum(
  SUPPORTED_CURRENCIES.map((currency) => currency.code) as [
    CurrencyCode,
    ...CurrencyCode[],
  ],
);

/** The currency's own symbol, falling back to the code for unknown values. */
export function currencySymbol(code: string): string {
  return (
    SUPPORTED_CURRENCIES.find((currency) => currency.code === code)?.symbol ??
    code
  );
}
