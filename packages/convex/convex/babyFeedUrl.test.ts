import { expect, test } from "vitest";
import { BABY_FEED_HASH, babyFeedUrl } from "../src/babyFeedUrl";

test("points notification taps at the baby page feed landmark", () => {
  expect(BABY_FEED_HASH).toBe("feed");
  expect(babyFeedUrl("baby-waiting")).toBe("/baby/baby-waiting#feed");
});
