import {
  digitsToMinor,
  formatAmount,
  fromMinor,
  MAX_AMOUNT_DIGITS,
} from "../money";

describe("fromMinor", () => {
  test("scales minor units back to major units for display", () => {
    expect(fromMinor(1234, "USD")).toBe(12.34);
    expect(fromMinor(1234, "JPY")).toBe(1234);
    expect(fromMinor(-5, "USD")).toBe(-0.05);
  });
});

describe("digitsToMinor", () => {
  test("treats the text as the digits typed so far", () => {
    expect(digitsToMinor("")).toBe(0);
    expect(digitsToMinor("1")).toBe(1);
    expect(digitsToMinor("12")).toBe(12);
    expect(digitsToMinor("1234")).toBe(1234);
  });

  test("ignores the symbols and separators the field displays", () => {
    expect(digitsToMinor("$12.34")).toBe(1234);
    expect(digitsToMinor("$1,234.56")).toBe(123456);
    expect(digitsToMinor("1.234,56 €")).toBe(123456);
    expect(digitsToMinor("¥1,234")).toBe(1234);
    expect(digitsToMinor("USD 1 234.56")).toBe(123456);
  });

  test("walks back as characters are deleted", () => {
    // The text after each backspace from "$12.34".
    expect(digitsToMinor("$12.3")).toBe(123);
    expect(digitsToMinor("$12.")).toBe(12);
    expect(digitsToMinor("$1")).toBe(1);
    expect(digitsToMinor("$")).toBe(0);
  });

  test("keeps leading zeros from inflating the amount", () => {
    expect(digitsToMinor("000")).toBe(0);
    expect(digitsToMinor("007")).toBe(7);
  });

  test("stops accepting digits at the field's limit", () => {
    const nines = "9".repeat(MAX_AMOUNT_DIGITS);

    expect(digitsToMinor(nines)).toBe(Number(nines));
    expect(digitsToMinor(`${nines}9`)).toBe(Number(nines));
  });

  test("never returns a value a Postgres integer can't hold", () => {
    expect(digitsToMinor("9".repeat(20))).toBeLessThan(2_147_483_647);
  });
});

describe("formatAmount", () => {
  test("formats with the currency's own precision", () => {
    expect(formatAmount(123456, "USD", { locale: "en-US" })).toBe("$1,234.56");
    expect(formatAmount(1234, "JPY", { locale: "en-US" })).toBe("¥1,234");
  });

  test("can hide or force the sign", () => {
    expect(formatAmount(-500, "USD", { locale: "en-US" })).toBe("-$5.00");
    expect(
      formatAmount(-500, "USD", { locale: "en-US", signDisplay: "never" }),
    ).toBe("$5.00");
    expect(
      formatAmount(500, "USD", { locale: "en-US", signDisplay: "always" }),
    ).toBe("+$5.00");
  });

  test("round-trips what an amount field produces", () => {
    expect(
      formatAmount(digitsToMinor("1234"), "USD", { locale: "en-US" }),
    ).toBe("$12.34");
  });
});
