import { TRPCClientError } from "@trpc/client";
import {
  apiErrorMessage,
  joinErrorMessage,
  outstandingBalanceRefusal,
} from "./errors";

/** What a link hands the caller once the server has refused. */
const apiError = (code: string, message: string) =>
  TRPCClientError.from({
    error: {
      code: -32603,
      message,
      data: { code, httpStatus: 412, path: "household.removeMember" },
    },
  });

/** A dropped connection — a `TRPCClientError` too, but with no shape on it. */
const transportError = () =>
  TRPCClientError.from(new Error("Network request failed"));

describe("outstandingBalanceRefusal", () => {
  it("keeps the sentence naming the balance and drops the instruction", () => {
    const error = apiError(
      "PRECONDITION_FAILED",
      "Ana still owes Simon 214.30 USD. Write the balance off to remove them anyway.",
    );

    expect(outstandingBalanceRefusal(error)).toBe(
      "Ana still owes Simon 214.30 USD.",
    );
  });

  it("keeps every pair when more than one is outstanding", () => {
    const error = apiError(
      "PRECONDITION_FAILED",
      "Ana still owes Simon 10.00 USD; Bo still owes Ana 4.00 USD. Write the balance off to remove them anyway.",
    );

    expect(outstandingBalanceRefusal(error)).toBe(
      "Ana still owes Simon 10.00 USD; Bo still owes Ana 4.00 USD.",
    );
  });

  // The other PRECONDITION_FAILED. Offering a write-off for it would put the
  // user through the same dialog forever.
  it("ignores the last-owner refusal", () => {
    const error = apiError(
      "PRECONDITION_FAILED",
      "A household must keep at least one owner",
    );

    expect(outstandingBalanceRefusal(error)).toBeNull();
  });

  it("ignores anything that isn't an API refusal", () => {
    expect(outstandingBalanceRefusal(transportError())).toBeNull();
    expect(outstandingBalanceRefusal(new Error("boom"))).toBeNull();
  });
});

describe("apiErrorMessage", () => {
  it("quotes the server", () => {
    const error = apiError("FORBIDDEN", "Only the household owner can do that");

    expect(apiErrorMessage(error, "fallback")).toBe(
      "Only the household owner can do that",
    );
  });

  it("falls back when the request never reached the router", () => {
    expect(apiErrorMessage(transportError(), "fallback")).toBe("fallback");
  });
});

describe("joinErrorMessage", () => {
  it("explains the codes the join screen owns", () => {
    const error = apiError(
      "NOT_FOUND",
      "That invite is not valid for this account",
    );

    expect(joinErrorMessage(error)).toContain("different email address");
  });

  // CONFLICT covers three refusals; only the server knows which one happened.
  it("passes a conflict through verbatim", () => {
    const message =
      "Your current household still has bank connections, transactions or other members. Leave it before joining another one.";

    expect(joinErrorMessage(apiError("CONFLICT", message))).toBe(message);
  });

  it("says nothing specific about a dropped connection", () => {
    expect(joinErrorMessage(transportError())).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
