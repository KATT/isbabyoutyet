import { describe, expect, it } from "vitest";
import * as Schema from "effect/Schema";
import { ConvexEnv } from "../src/env";

const validEnv = {
  BETTER_AUTH_SECRET: "secret",
  VAPID_PUBLIC_KEY: "pub",
  VAPID_PRIVATE_KEY: "priv",
  SITE_URL: "https://example.com",
};

describe("ConvexEnv", () => {
  it("decodes a complete env object", () => {
    expect(
      Schema.decodeUnknownSync(ConvexEnv)({
        ...validEnv,
        VAPID_SUBJECT: "mailto:custom@example.com",
      }),
    ).toEqual({
      ...validEnv,
      VAPID_SUBJECT: "mailto:custom@example.com",
    });
  });

  it("defaults VAPID_SUBJECT when missing or undefined", () => {
    expect(Schema.decodeUnknownSync(ConvexEnv)(validEnv).VAPID_SUBJECT).toBe(
      "mailto:admin@isbabyoutyet.com",
    );
    expect(
      Schema.decodeUnknownSync(ConvexEnv)({
        ...validEnv,
        VAPID_SUBJECT: undefined,
      }).VAPID_SUBJECT,
    ).toBe("mailto:admin@isbabyoutyet.com");
  });

  it("rejects an invalid SITE_URL", () => {
    expect(() =>
      Schema.decodeUnknownSync(ConvexEnv)({
        ...validEnv,
        SITE_URL: "not-a-url",
      }),
    ).toThrow("SITE_URL must be a valid URL");
  });

  it("rejects an empty BETTER_AUTH_SECRET", () => {
    expect(() =>
      Schema.decodeUnknownSync(ConvexEnv)({
        ...validEnv,
        BETTER_AUTH_SECRET: "",
      }),
    ).toThrow("Expected a value with a length of at least 1");
  });
});
