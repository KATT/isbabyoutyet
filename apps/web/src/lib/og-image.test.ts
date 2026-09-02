import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { isString } from "@workspace/runtime/guards";
import { createHomepageOgImage, createBabyOgImage } from "@/lib/og-image";

const TEST_FONT_URL = "https://fonts.gstatic.com/s/test.ttf";

function requestUrl(input: RequestInfo | URL) {
  if (isString(input)) {
    return input;
  }
  if ("url" in input) {
    return input.url;
  }
  return input.href;
}

async function stubOgImageFonts() {
  // Local TTF so these tests do not fetch Google Fonts (and do not need a
  // raised Vitest timeout).
  const fontBytes = await readFile(join(import.meta.dirname, "og-image.test.font.ttf"));
  const originalFetch = globalThis.fetch;
  const fetchStub: typeof fetch = async (input, init) => {
    const url = requestUrl(input);
    if (url.includes("fonts.googleapis.com")) {
      return new Response(`@font-face { src: url(${TEST_FONT_URL}); }`);
    }
    if (url === TEST_FONT_URL) {
      return new Response(fontBytes);
    }
    return originalFetch(input, init);
  };
  vi.stubGlobal("fetch", fetchStub);
  return makeResource({}, () => {
    vi.unstubAllGlobals();
  });
}

test("homepage OG image returns a PNG response", async () => {
  await using _fonts = await stubOgImageFonts();
  const response = await createHomepageOgImage("en-GB");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("image/png");
  expect(response.headers.get("cache-control")).toBeNull();
  const bytes = new Uint8Array(await response.arrayBuffer());
  // PNG magic number
  expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});

test("baby OG image includes status-aware card as PNG", async () => {
  await using _fonts = await stubOgImageFonts();
  const response = await createBabyOgImage({
    babyBorn: null,
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact",
    laborStarted: null,
    locale: "en-GB",
    name: "Juniper",
    photoUrl: null,
    theme: "sunny-days",
    wentToHospital: null,
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("image/png");
  expect(response.headers.get("cache-control")).toBeNull();
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.byteLength).toBeGreaterThan(5000);
});

test("baby OG image renders message-mode due date copy as PNG", async () => {
  await using _fonts = await stubOgImageFonts();
  const response = await createBabyOgImage({
    babyBorn: null,
    dueDateDisplayMode: "message",
    laborStarted: null,
    locale: "en-GB",
    name: "Nova",
    photoUrl: null,
    publicDueDateText: "Any day now",
    theme: "sunny-days",
    wentToHospital: null,
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("image/png");
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.byteLength).toBeGreaterThan(5000);
});
