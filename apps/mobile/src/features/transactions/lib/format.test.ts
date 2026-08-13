import {
  formatAccountLabel,
  formatCategory,
  formatTransactionAmount,
} from "./format";

describe("formatTransactionAmount", () => {
  test("a positive amount is an outflow — Plaid's sign convention", () => {
    expect(formatTransactionAmount("12.34", "USD")).toEqual({
      text: "$12.34",
      isInflow: false,
    });
  });

  test("a negative amount is an inflow and is marked with +", () => {
    expect(formatTransactionAmount("-1250.5", "USD")).toEqual({
      text: "+$1,250.50",
      isInflow: true,
    });
  });

  test("zero is not an inflow", () => {
    expect(formatTransactionAmount("0", "USD").isInflow).toBe(false);
  });

  test("falls back to a plain decimal when the currency is null", () => {
    expect(formatTransactionAmount("12.34", null)).toEqual({
      text: "12.34",
      isInflow: false,
    });
  });

  test("falls back to a plain decimal for an unofficial currency code", () => {
    expect(formatTransactionAmount("12.34", "XBT").text).toContain("12.34");
  });

  test("returns a dash for a non-numeric amount", () => {
    expect(formatTransactionAmount("not-a-number").text).toBe("—");
  });

  test("returns a dash for an empty string rather than $0.00", () => {
    // Number("") is 0, which would render as a real zero-dollar transaction.
    expect(formatTransactionAmount("").text).toBe("—");
  });
});

describe("formatAccountLabel", () => {
  test("appends the mask when present", () => {
    expect(formatAccountLabel("Sapphire", "4242")).toBe("Sapphire •••• 4242");
  });

  test("omits the mask when absent", () => {
    expect(formatAccountLabel("Sapphire", null)).toBe("Sapphire");
  });
});

describe("formatCategory", () => {
  test("humanizes a Plaid category", () => {
    expect(formatCategory("FOOD_AND_DRINK")).toBe("Food and drink");
  });

  test("returns null when there is no category", () => {
    expect(formatCategory(null)).toBeNull();
  });
});
