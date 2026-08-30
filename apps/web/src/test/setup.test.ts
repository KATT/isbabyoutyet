import { makeResource } from "@workspace/convex/convex/test.resource";
import { isString } from "@workspace/runtime/guards";
import { expect, test, vi } from "vitest";

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

test("window scroll APIs do not emit jsdom not-implemented errors", async () => {
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
