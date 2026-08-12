import { expect, test, vi } from "vitest";
import { makeResource } from "../convex/test.resource";
import { convexEnvSchema } from "./env";

function useEnvResource() {
  return makeResource({}, () => {
    vi.unstubAllEnvs();
  });
}

test("convexEnvSchema parses a full environment and defaults VAPID_SUBJECT", async () => {
  await using _env = useEnvResource();
  vi.stubEnv("BETTER_AUTH_SECRET", "secret");
  vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  vi.stubEnv("SITE_URL", "https://example.com");

  const parsed = convexEnvSchema.parse(process.env);
  expect(parsed).toMatchObject({
    BETTER_AUTH_SECRET: "secret",
    VAPID_PUBLIC_KEY: "pub",
    VAPID_PRIVATE_KEY: "priv",
    VAPID_SUBJECT: "mailto:admin@isbabyoutyet.com",
    SITE_URL: "https://example.com",
  });
});

test("convexEnvSchema rejects an invalid SITE_URL", async () => {
  await using _env = useEnvResource();
  vi.stubEnv("BETTER_AUTH_SECRET", "secret");
  vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  vi.stubEnv("SITE_URL", "not-a-url");

  expect(() => convexEnvSchema.parse(process.env)).toThrow("SITE_URL must be a valid URL");
});
