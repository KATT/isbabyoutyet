import { makeResource } from "@workspace/convex/convex/test.resource";
import { isString } from "@workspace/runtime/guards";
import { expect, test, vi } from "vitest";
import { stubJsdomWindow } from "@/test/stubJsdomWindow";

async function notImplementedMessages(run: () => void) {
  const spy = vi.spyOn(console, "error");
  await using _spy = makeResource({}, () => {
    spy.mockRestore();
  });
  run();
  return spy.mock.calls
    .map((call) => call[0])
    .filter((message) => isString(message) && message.startsWith("Not implemented:"));
}

test("window scroll APIs stay quiet while stubJsdomWindow is held", async () => {
  await using _window = stubJsdomWindow();
  expect(
    await notImplementedMessages(() => {
      window.scrollTo(0, 0);
      window.scrollTo({ top: 0, behavior: "auto" });
      window.scroll(0, 0);
      window.scrollBy(0, 10);
    }),
  ).toEqual([]);
});

test("location reload and href assignment stay on this document", async () => {
  await using _window = stubJsdomWindow();
  const href = window.location.href;
  expect(
    await notImplementedMessages(() => {
      window.location.reload();
      window.location.assign("/elsewhere");
      window.location.replace("/elsewhere");
      window.location.href = "/elsewhere";
    }),
  ).toEqual([]);
  expect(window.location.href).toBe(href);
});

test("nested stubJsdomWindow keeps stubs until the last resource disposes", async () => {
  await using _outer = stubJsdomWindow();
  {
    await using _inner = stubJsdomWindow();
    expect(await notImplementedMessages(() => window.scrollTo(0, 0))).toEqual([]);
  }
  expect(await notImplementedMessages(() => window.scrollTo(0, 0))).toEqual([]);
});

test("restores the previous window.scrollTo after dispose", async () => {
  const original = window.scrollTo;
  {
    await using _window = stubJsdomWindow();
    expect(window.scrollTo).not.toBe(original);
    expect(await notImplementedMessages(() => window.scrollTo(0, 0))).toEqual([]);
  }
  expect(window.scrollTo).toBe(original);
});
