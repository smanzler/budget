import { describe, expect, test } from "vitest";
import { buildPushMessage, getTicketOutcome } from "./expo";

const VALID_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

describe("buildPushMessage", () => {
  test("builds a message for a valid Expo push token", () => {
    const message = buildPushMessage({
      token: VALID_TOKEN,
      title: "Title",
      body: "Body",
      data: { postId: "abc" },
    });

    expect(message).toEqual({
      to: VALID_TOKEN,
      title: "Title",
      body: "Body",
      data: { postId: "abc" },
      sound: "default",
    });
  });

  test("returns null for an invalid token", () => {
    const message = buildPushMessage({
      token: "not-a-real-token",
      title: "Title",
      body: "Body",
    });

    expect(message).toBeNull();
  });

  test("omits body and data when not provided", () => {
    const message = buildPushMessage({
      token: VALID_TOKEN,
      title: "Title",
    });

    expect(message).toEqual({
      to: VALID_TOKEN,
      title: "Title",
      body: undefined,
      data: undefined,
      sound: "default",
    });
  });
});

describe("getTicketOutcome", () => {
  test("returns sent for an ok ticket", () => {
    expect(getTicketOutcome({ status: "ok", id: "receipt-id" })).toEqual({
      status: "sent",
    });
  });

  test("returns failed with the message for a generic error ticket", () => {
    expect(
      getTicketOutcome({ status: "error", message: "Message too big" }),
    ).toEqual({
      status: "failed",
      lastError: "Message too big",
      invalidToken: false,
    });
  });

  test("flags invalidToken when Expo reports DeviceNotRegistered", () => {
    expect(
      getTicketOutcome({
        status: "error",
        message: "The recipient device is not registered",
        details: { error: "DeviceNotRegistered" },
      }),
    ).toEqual({
      status: "failed",
      lastError: "The recipient device is not registered",
      invalidToken: true,
    });
  });
});
