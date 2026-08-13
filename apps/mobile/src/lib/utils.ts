import { clsx, type ClassValue } from "clsx";
import { router } from "expo-router";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const goBack = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${secs}s`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
};

// Module level, not a hook: React Compiler forbids mutable state in a component
// body, and Intl.NumberFormat construction is the expensive part.
const currencyFormatters = new Map<string, Intl.NumberFormat>();

/**
 * `currency` is nullable throughout the Plaid data, and unofficial codes make
 * `Intl` throw, so both fall back to a plain decimal rather than crashing a row.
 */
const formatCurrency = (
  value: number,
  currency?: string | null,
  locale = "en-US",
) => {
  if (!Number.isFinite(value)) return "—";

  const key = `${locale}:${currency ?? ""}`;
  let formatter = currencyFormatters.get(key);

  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(locale, {
        style: currency ? "currency" : "decimal",
        ...(currency ? { currency } : {}),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    currencyFormatters.set(key, formatter);
  }

  return formatter.format(value);
};

export { formatCurrency, formatDate, formatDuration, goBack };
