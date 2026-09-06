/** Who moves the money: the current user pays, or the current user is paid. */
export type Direction = "pay" | "receive";

/** Anything other than "receive" reads as "pay". */
export function parseDirection(value: string | undefined): Direction {
  return value === "receive" ? "receive" : "pay";
}
