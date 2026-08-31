import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { createDismissedIdsStore, useIsDismissed } from "./use-dismissed-ids";

test("dismissing an id re-renders subscribers as dismissed", async () => {
  const store = createDismissedIdsStore();
  const hook = renderHook((props) => useIsDismissed(store, props.id), {
    initialProps: { id: "juniper-hale" },
  });
  await using _hook = makeResource({}, () => hook.unmount());

  expect(hook.result.current).toBe(false);
  act(() => store.dismiss("juniper-hale"));
  expect(hook.result.current).toBe(true);
});

test("dismissing one id does not dismiss another", async () => {
  const store = createDismissedIdsStore();
  const hook = renderHook((props) => useIsDismissed(store, props.id), {
    initialProps: { id: "ella-holm" },
  });
  await using _hook = makeResource({}, () => hook.unmount());

  act(() => store.dismiss("juniper-hale"));
  expect(hook.result.current).toBe(false);

  hook.rerender({ id: "juniper-hale" });
  expect(hook.result.current).toBe(true);
});
