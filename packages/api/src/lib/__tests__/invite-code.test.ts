import { describe, expect, test } from "vitest";
import { INVITE_CODE_LENGTH } from "@budget/shared";
import {
  generateInviteCode,
  INVITE_TTL_DAYS,
  inviteExpiryFrom,
  isInviteUsable,
  isValidInviteCode,
  normalizeInviteCode,
} from "../invite-code";

describe("generateInviteCode", () => {
  test("produces codes of the expected shape", () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = generateInviteCode();

      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
      expect(isValidInviteCode(code)).toBe(true);
    }
  });

  test("is already in canonical form", () => {
    const code = generateInviteCode();

    expect(normalizeInviteCode(code)).toBe(code);
  });

  test("does not repeat itself", () => {
    const codes = new Set(
      Array.from({ length: 200 }, () => generateInviteCode()),
    );

    expect(codes.size).toBe(200);
  });
});

describe("normalizeInviteCode", () => {
  test("upper-cases and strips the punctuation people type", () => {
    expect(normalizeInviteCode("a2c4-e6g8")).toBe("A2C4E6G8");
    expect(normalizeInviteCode(" a2c4 e6g8 ")).toBe("A2C4E6G8");
  });

  test("folds the characters that look alike", () => {
    expect(normalizeInviteCode("olive")).toBe("011VE");
    expect(normalizeInviteCode("O0")).toBe("00");
    expect(normalizeInviteCode("Il1")).toBe("111");
  });
});

describe("isValidInviteCode", () => {
  // Derived from the constant so these keep holding if the length changes.
  const code = "A2C4E6G8H0JK".slice(0, INVITE_CODE_LENGTH);

  test("accepts a code of the right length after normalisation", () => {
    expect(isValidInviteCode(code)).toBe(true);
    expect(isValidInviteCode(code.toLowerCase())).toBe(true);
    expect(isValidInviteCode(` ${code.slice(0, 2)}-${code.slice(2)} `)).toBe(
      true,
    );
  });

  test("rejects codes of the wrong length", () => {
    expect(isValidInviteCode("")).toBe(false);
    expect(isValidInviteCode(code.slice(0, -1))).toBe(false);
    expect(isValidInviteCode(`${code}9`)).toBe(false);
  });
});

describe("isInviteUsable", () => {
  const now = new Date("2026-08-27T12:00:00Z");

  test("accepts an invite that has neither expired nor been revoked", () => {
    expect(
      isInviteUsable(
        { expiresAt: new Date("2026-08-28T12:00:00Z"), revokedAt: null },
        now,
      ),
    ).toBe(true);
  });

  test("rejects an expired invite, including one expiring exactly now", () => {
    expect(
      isInviteUsable(
        { expiresAt: new Date("2026-08-26T12:00:00Z"), revokedAt: null },
        now,
      ),
    ).toBe(false);
    expect(isInviteUsable({ expiresAt: now, revokedAt: null }, now)).toBe(
      false,
    );
  });

  test("rejects a revoked invite even before it expires", () => {
    expect(
      isInviteUsable(
        {
          expiresAt: new Date("2026-08-28T12:00:00Z"),
          revokedAt: new Date("2026-08-27T09:00:00Z"),
        },
        now,
      ),
    ).toBe(false);
  });
});

describe("inviteExpiryFrom", () => {
  test("expires the configured number of days out", () => {
    const now = new Date("2026-08-27T12:00:00Z");
    const expiresAt = inviteExpiryFrom(now);

    expect(expiresAt.toISOString()).toBe("2026-09-10T12:00:00.000Z");
    expect(isInviteUsable({ expiresAt, revokedAt: null }, now)).toBe(true);
    expect(INVITE_TTL_DAYS).toBe(14);
  });
});
