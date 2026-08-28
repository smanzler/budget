import { randomInt } from "node:crypto";
import { INVITE_CODE_LENGTH } from "@budget/shared";

/**
 * Invite codes get read aloud, retyped and pasted with stray spacing, so they
 * use Crockford's base32 alphabet — no I, L, O or U — and are normalised on the
 * way in so "o" and "0" (or "l" and "1") resolve to the same code.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const INVITE_TTL_DAYS = 14;

export function generateInviteCode(): string {
  let code = "";

  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }

  return code;
}

/** Canonical form of a typed or pasted code, for both storage and lookup. */
export function normalizeInviteCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}

export function isValidInviteCode(input: string): boolean {
  const normalized = normalizeInviteCode(input);

  return (
    normalized.length === INVITE_CODE_LENGTH &&
    [...normalized].every((character) => ALPHABET.includes(character))
  );
}

/** An invite works until it is revoked or expires. */
export function isInviteUsable(
  invite: { expiresAt: Date; revokedAt: Date | null },
  now: Date,
): boolean {
  return (
    invite.revokedAt === null && invite.expiresAt.getTime() > now.getTime()
  );
}

export function inviteExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
