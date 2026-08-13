import { describe, expect, test } from "vitest";
import { decrypt, encrypt } from "./crypto";

const TOKEN = "access-sandbox-11111111-2222-3333-4444-555555555555";

describe("encrypt / decrypt", () => {
  test("round-trips a value", () => {
    expect(decrypt(encrypt(TOKEN))).toBe(TOKEN);
  });

  test("produces a different ciphertext each time (random IV)", () => {
    expect(encrypt(TOKEN)).not.toBe(encrypt(TOKEN));
  });

  test("rejects a tampered ciphertext rather than returning garbage", () => {
    const [iv, authTag, ciphertext] = encrypt(TOKEN).split(":");
    const flipped = ciphertext!.startsWith("0")
      ? `1${ciphertext!.slice(1)}`
      : `0${ciphertext!.slice(1)}`;

    expect(() => decrypt(`${iv}:${authTag}:${flipped}`)).toThrow();
  });

  test("rejects a tampered auth tag", () => {
    const [iv, authTag, ciphertext] = encrypt(TOKEN).split(":");
    const flipped = authTag!.startsWith("0")
      ? `1${authTag!.slice(1)}`
      : `0${authTag!.slice(1)}`;

    expect(() => decrypt(`${iv}:${flipped}:${ciphertext}`)).toThrow();
  });

  test("rejects a malformed payload", () => {
    expect(() => decrypt("not-encrypted")).toThrow(
      "Malformed encrypted payload",
    );
  });
});
