import { expect, test } from "vitest";
import { parsePushDevice } from "../src/pushDevice";

test("parsePushDevice records platform and OS version from common user agents", () => {
  expect(
    parsePushDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1",
    ),
  ).toMatchObject({ platform: "ios", osVersion: "18.2" });
  expect(
    parsePushDevice(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    ),
  ).toMatchObject({ platform: "android", osVersion: "14" });
  expect(
    parsePushDevice(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ),
  ).toMatchObject({ platform: "desktop", osVersion: "10.15.7" });
  expect(parsePushDevice("UnknownBot/1.0")).toMatchObject({
    platform: "desktop",
    osVersion: null,
  });
});
