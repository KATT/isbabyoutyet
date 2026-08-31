import { expect, test } from "vitest";
import { isBabyOverlayPath, shouldReuseBabyClient } from "./notification-click";

test("treats photo and manager overlays as distinct documents", () => {
  expect(isBabyOverlayPath("/baby/baby-waiting/photo")).toBe(true);
  expect(isBabyOverlayPath("/baby/baby-waiting/settings")).toBe(true);
  expect(isBabyOverlayPath("/baby/baby-waiting/post")).toBe(true);
  expect(isBabyOverlayPath("/baby/baby-waiting/share")).toBe(true);
  expect(isBabyOverlayPath("/baby/baby-waiting/login")).toBe(true);
  expect(isBabyOverlayPath("/baby/baby-waiting/login/")).toBe(true);
  expect(isBabyOverlayPath("/baby/baby-waiting/updates/abc/photo")).toBe(true);
  expect(isBabyOverlayPath("/baby/baby-waiting")).toBe(false);
});

test("reuses the open baby tab even when only the hash differs", () => {
  expect(
    shouldReuseBabyClient({
      clientUrl: "https://isbabyoutyet.com/baby/baby-waiting",
      targetUrl: "https://isbabyoutyet.com/baby/baby-waiting#feed",
    }),
  ).toBe(true);
});

test("does not steal a photo lightbox tab for a feed notification", () => {
  expect(
    shouldReuseBabyClient({
      clientUrl: "https://isbabyoutyet.com/baby/baby-waiting/photo",
      targetUrl: "https://isbabyoutyet.com/baby/baby-waiting#feed",
    }),
  ).toBe(false);
});

test("does not reuse a tab for a different baby", () => {
  expect(
    shouldReuseBabyClient({
      clientUrl: "https://isbabyoutyet.com/baby/baby-waiting",
      targetUrl: "https://isbabyoutyet.com/baby/other-baby#feed",
    }),
  ).toBe(false);
});

test("does not reuse a tab from another origin", () => {
  expect(
    shouldReuseBabyClient({
      clientUrl: "https://preview.example/baby/baby-waiting",
      targetUrl: "https://isbabyoutyet.com/baby/baby-waiting#feed",
    }),
  ).toBe(false);
});

test("does not reuse a login overlay tab for a feed notification", () => {
  expect(
    shouldReuseBabyClient({
      clientUrl: "https://isbabyoutyet.com/baby/baby-waiting/login",
      targetUrl: "https://isbabyoutyet.com/baby/baby-waiting#feed",
    }),
  ).toBe(false);
});
