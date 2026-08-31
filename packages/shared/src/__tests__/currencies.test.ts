import { describe, expect, test } from "vitest";
import { currencyExponent } from "../currencies";

describe("currencyExponent", () => {
  test("comes from the supported currency list", () => {
    expect(currencyExponent("USD")).toBe(2);
    expect(currencyExponent("eur")).toBe(2);
    expect(currencyExponent("JPY")).toBe(0);
  });

  test("assumes two decimals for anything unlisted", () => {
    expect(currencyExponent("XYZ")).toBe(2);
  });
});
