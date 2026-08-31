import { z } from "zod";

export const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", exponent: 2 },
  { code: "EUR", name: "Euro", symbol: "€", exponent: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", exponent: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", exponent: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", exponent: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", exponent: 2 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", exponent: 2 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", exponent: 2 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", exponent: 2 },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", exponent: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", exponent: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", exponent: 0 },
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

export const DEFAULT_CURRENCY_EXPONENT = 2;

export function currencyExponent(currency: string): number {
  const code = currency.toUpperCase();

  return (
    SUPPORTED_CURRENCIES.find((supported) => supported.code === code)
      ?.exponent ?? DEFAULT_CURRENCY_EXPONENT
  );
}
