import type { AppRouter } from "@budget/api";
import { isTRPCClientError } from "@trpc/client";

/**
 * These procedures refuse in whole sentences; prefer them over our own copy.
 *
 * Gated on `data` rather than on the error being a tRPC one: a dropped
 * connection arrives as a `TRPCClientError` too, and "Network request failed"
 * is not a sentence to put in front of anybody.
 */
export const apiErrorMessage = (error: unknown, fallback: string): string =>
  isTRPCClientError<AppRouter>(error) && error.data ? error.message : fallback;

const WRITE_OFF_INSTRUCTION = "Write the balance off";

/**
 * The sentence `removeMember` refuses with while the member still owes, or
 * `null` for every other failure.
 *
 * The code alone can't decide this: PRECONDITION_FAILED also covers "a
 * household must keep at least one owner", which no write-off can fix. The
 * trailing instruction is dropped — the dialog's own button says it better.
 */
export const outstandingBalanceRefusal = (error: unknown): string | null => {
  if (!isTRPCClientError<AppRouter>(error)) return null;
  if (error.data?.code !== "PRECONDITION_FAILED") return null;

  const at = error.message.indexOf(WRITE_OFF_INSTRUCTION);

  return at === -1 ? null : error.message.slice(0, at).trim();
};

const JOIN_ERRORS: Record<string, string> = {
  NOT_FOUND:
    "This invite was sent to a different email address. Sign in as the person it was addressed to, then open the link again.",
  BAD_REQUEST: "This invite has expired. Ask them to send you a new one.",
  FORBIDDEN:
    "Your email address isn't verified yet. Sign out, sign back in with the code we email you, then open the link again.",
};

/**
 * Why the join failed, in words.
 *
 * CONFLICT deliberately falls through to the server's own sentence: it covers
 * three different refusals — the invite was used, you are already in this
 * household, and your current household still holds data — and one line of copy
 * would be actively wrong for two of them.
 */
export const joinErrorMessage = (error: unknown): string => {
  // No `data` means it never reached the router — a dropped connection, not a
  // refusal, and none of the copy above applies to it.
  if (!isTRPCClientError<AppRouter>(error) || !error.data) {
    return "Something went wrong. Please try again.";
  }

  return JOIN_ERRORS[error.data.code] ?? error.message;
};
