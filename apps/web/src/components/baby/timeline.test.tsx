import { fireEvent, render } from "@testing-library/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactElement } from "react";
import { expect, test } from "vitest";
import { UpdateComposer } from "@/components/baby/timeline";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { makeResource } from "@workspace/convex/tests/test.resource";
import type { BabyData } from "@workspace/convex/src/types";

const notYetBaby: BabyData = {
  name: "Baby Smith",
  dueDate: "2026-09-01",
  laborStarted: null,
  wentToHospital: null,
  babyBorn: null,
};

const laborStartedBaby: BabyData = {
  ...notYetBaby,
  laborStarted: "2026-08-20T08:00:00.000Z",
};

// The mutations are never invoked in these tests; the client only needs to
// exist for the `useMutation` hooks to mount.
const babyId = "fake-baby-id" as Id<"baby">;

function renderComposerResource(baby: BabyData) {
  const client = new ConvexReactClient("https://example.convex.cloud", {
    unsavedChangesWarning: false,
  });
  const withProvider = (currentBaby: BabyData): ReactElement => (
    <ConvexProvider client={client}>
      <UpdateComposer babyId={babyId} baby={currentBaby} babyName={currentBaby.name} />
    </ConvexProvider>
  );
  const view = render(withProvider(baby));
  return makeResource(
    {
      view,
      setBaby: (currentBaby: BabyData) => view.rerender(withProvider(currentBaby)),
    },
    async () => {
      view.unmount();
      await client.close();
    },
  );
}

test("the status radio group is labelled and offers only future stages", async () => {
  await using composer = renderComposerResource(notYetBaby);
  const view = composer.view;

  const group = view.getByRole("radiogroup", { name: "Status change (optional)" });
  expect(group).toBeTruthy();

  expect(view.getByRole("radio", { name: "No status change" }).getAttribute("aria-checked")).toBe(
    "true",
  );
  expect(view.getByRole("radio", { name: "Labour started" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Gone to hospital" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Born" })).toBeTruthy();

  // Once labour has started, that stage is no longer offered
  composer.setBaby(laborStartedBaby);
  expect(view.queryByRole("radio", { name: "Labour started" })).toBeNull();
  expect(view.getByRole("radio", { name: "Gone to hospital" })).toBeTruthy();
});

test("a stale milestone selection is cleared when the status advances elsewhere", async () => {
  await using composer = renderComposerResource(notYetBaby);
  const view = composer.view;

  fireEvent.click(view.getByRole("radio", { name: "Labour started" }));
  expect(view.getByRole("radio", { name: "Labour started" }).getAttribute("aria-checked")).toBe(
    "true",
  );

  // The status advances from another tab: the stale choice is dropped
  composer.setBaby(laborStartedBaby);
  expect(view.getByRole("radio", { name: "No status change" }).getAttribute("aria-checked")).toBe(
    "true",
  );

  // ...and it must not resurface if the milestone is unmarked again later
  composer.setBaby(notYetBaby);
  expect(view.getByRole("radio", { name: "Labour started" }).getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(view.getByRole("radio", { name: "No status change" }).getAttribute("aria-checked")).toBe(
    "true",
  );
});
