import { expect, test } from "vitest";
import { HOMEPAGE_DEMO_BABIES } from "@workspace/convex/src/seedCredentials";
import {
  babyPageRobotsHeaders,
  isIndexableBabyPublicId,
  noIndexHeaders,
  robotsTxt,
  searchRobotsMeta,
} from "@/lib/robots";

test("only homepage live-demo baby pages are indexable", () => {
  expect(isIndexableBabyPublicId("juniper-hale")).toBe(true);
  expect(isIndexableBabyPublicId("willow-brooks")).toBe(true);
  expect(isIndexableBabyPublicId("ella-holm")).toBe(true);
  expect(isIndexableBabyPublicId("lucia-navarro")).toBe(true);
  expect(isIndexableBabyPublicId("helena-costa")).toBe(true);
  expect(isIndexableBabyPublicId("baby-waiting")).toBe(false);
  expect(isIndexableBabyPublicId("baby-born")).toBe(false);
  expect(isIndexableBabyPublicId("some-real-family-page")).toBe(false);
});

test("robots.txt blocks family baby pages and allows live demos", () => {
  const body = robotsTxt();
  expect(body).toContain("Disallow: /baby/");
  expect(body).toContain("Disallow: /og/baby/");
  for (const baby of Object.values(HOMEPAGE_DEMO_BABIES)) {
    expect(body).toContain(`Allow: /baby/${baby.publicId}`);
    expect(body).toContain(`Allow: /og/baby/${baby.publicId}`);
  }
});

test("robots.txt lets model-training crawlers index the homepage and live demos", () => {
  const body = robotsTxt();
  expect(body).toContain("User-agent: GPTBot\nAllow: /");
  expect(body).toContain("User-agent: Google-Extended\nAllow: /");
  expect(body).toContain("User-agent: CCBot\nAllow: /");
  expect(body).toContain("User-agent: ClaudeBot\nAllow: /");
  expect(body).toContain("User-agent: Applebot-Extended\nAllow: /");
  expect(body).not.toContain("User-agent: GPTBot\nDisallow: /");
  for (const baby of Object.values(HOMEPAGE_DEMO_BABIES)) {
    expect(body).toContain(`Allow: /baby/${baby.publicId}`);
  }
});

test("search robots meta keeps Google indexing off family pages", () => {
  const indexed = searchRobotsMeta({ index: true });
  const hidden = searchRobotsMeta({ index: false });
  expect(indexed).toEqual([
    { name: "robots", content: "index, follow" },
    { name: "googlebot", content: "index, follow" },
  ]);
  expect(hidden.some((tag) => tag.content.includes("noindex"))).toBe(true);
  expect(hidden.some((tag) => tag.name === "googlebot" && tag.content.includes("noindex"))).toBe(
    true,
  );
});

test("noindex headers apply to private pages without blocking public demos", () => {
  expect(noIndexHeaders()).toEqual({ "X-Robots-Tag": "noindex, nofollow" });
  expect(babyPageRobotsHeaders("juniper-hale")).toEqual({});
  expect(babyPageRobotsHeaders("a-real-family-page")).toEqual(noIndexHeaders());
});
