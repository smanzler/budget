// All amounts are integer minor units: cents for USD, whole yen for JPY.

import { currencyExponent } from "@budget/shared";

/** 100 for USD, 1 for JPY. */
export function minorUnitScale(currency: string): number {
  return 10 ** currencyExponent(currency);
}

/** The result is a float. Use it only to show or to format a value. */
export function fromMinor(minor: number, currency: string): number {
  return minor / minorUnitScale(currency);
}

/** Nine digits keep the value inside the `integer` column it goes to. */
export const MAX_AMOUNT_DIGITS = 9;

/**
 * The text can contain a currency symbol and separators. Only the digits are
 * used, and digits after the ninth are removed.
 */
export function digitsToMinor(text: string): number {
  const digits = text.replace(/\D/g, "").slice(0, MAX_AMOUNT_DIGITS);

  return digits.length === 0 ? 0 : Number(digits);
}

type FormatAmountOptions = {
  locale?: string;
  signDisplay?: "auto" | "never" | "always";
};

function formatWithCode(
  value: number,
  currency: string,
  signDisplay: "auto" | "never" | "always",
): string {
  const exponent = currencyExponent(currency);
  const scale = minorUnitScale(currency);
  const magnitude = Math.abs(value);

  const whole = Math.trunc(magnitude / scale).toLocaleString("en-US");
  const fraction =
    exponent > 0 ? `.${String(magnitude % scale).padStart(exponent, "0")}` : "";
  const prefix = value < 0 ? "-" : signDisplay === "always" ? "+" : "";

  return `${prefix}${currency.toUpperCase()} ${whole}${fraction}`;
}

export function formatAmount(
  minor: number,
  currency: string,
  options: FormatAmountOptions = {},
): string {
  const { locale, signDisplay = "auto" } = options;
  const value = signDisplay === "never" ? Math.abs(minor) : minor;
  const exponent = currencyExponent(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
      signDisplay: signDisplay === "never" ? "auto" : signDisplay,
    }).format(fromMinor(value, currency));
  } catch {
    return formatWithCode(value, currency, signDisplay);
  }
}
