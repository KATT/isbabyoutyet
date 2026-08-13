import { fireEvent, render } from "@testing-library/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { UpdateComposer } from "@/components/baby/timeline";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { BabyData } from "@workspace/convex/src/types";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { LocaleProvider } from "@/lib/i18n";

// Observe what the composer submits: every useMutation hook in the component
// returns this mock (only updates.post is actually invoked in these tests)
const mocks = vi.hoisted(() => ({
  mutate: vi.fn<(args: unknown) => Promise<string>>(),
}));
vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  useMutation: () => mocks.mutate,
}));

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

function renderComposerResource(baby: BabyData, locale: SupportedLocale = "en-GB") {
  const client = new ConvexReactClient("https://example.convex.cloud", {
    unsavedChangesWarning: false,
  });
  const withProvider = (currentBaby: BabyData): ReactElement => (
    <LocaleProvider locale={locale}>
      <ConvexProvider client={client}>
        <UpdateComposer babyId={babyId} baby={currentBaby} babyName={currentBaby.name} />
      </ConvexProvider>
    </LocaleProvider>
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
  expect(view.getByRole("radio", { name: "Baby born" })).toBeTruthy();

  // Once labour has started, that stage is no longer offered
  composer.setBaby(laborStartedBaby);
  expect(view.queryByRole("radio", { name: "Labour started" })).toBeNull();
  expect(view.getByRole("radio", { name: "Gone to hospital" })).toBeTruthy();
});

test("the milestone metadata resolves through the Swedish catalog", async () => {
  await using composer = renderComposerResource(notYetBaby, "sv");
  const view = composer.view;

  expect(view.getByRole("radiogroup", { name: "Statusändring (valfritt)" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Ingen statusändring" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Förlossningen har börjat" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Åkt till sjukhuset" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Bebisen är född" })).toBeTruthy();
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

test("an untouched event-time picker does not post occurredAt", async () => {
  mocks.mutate.mockReset().mockResolvedValue("update-id");
  await using composer = renderComposerResource(notYetBaby);
  const view = composer.view;

  fireEvent.click(view.getByRole("radio", { name: "Labour started" }));
  // The picker appears, prefilled with "now" — leave it untouched
  expect(view.getByLabelText(/when did it happen/i)).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: /post & mark/i }));

  await vi.waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
  expect(mocks.mutate.mock.calls[0]?.[0]).toMatchObject({
    milestone: "labor_started",
    occurredAt: undefined,
  });
});

test("a cleared event-time picker blocks posting instead of silently meaning now", async () => {
  mocks.mutate.mockReset().mockResolvedValue("update-id");
  await using composer = renderComposerResource(notYetBaby);
  const view = composer.view;

  fireEvent.click(view.getByRole("radio", { name: "Labour started" }));
  fireEvent.change(view.getByLabelText(/when did it happen/i), { target: { value: "" } });

  const postButton = view.getByRole("button", { name: /post & mark/i }) as HTMLButtonElement;
  expect(postButton.disabled).toBe(true);
  fireEvent.click(postButton);
  expect(mocks.mutate).not.toHaveBeenCalled();
});

test("an explicitly edited event-time picker posts the backdated occurredAt", async () => {
  mocks.mutate.mockReset().mockResolvedValue("update-id");
  await using composer = renderComposerResource(notYetBaby);
  const view = composer.view;

  fireEvent.click(view.getByRole("radio", { name: "Labour started" }));
  const backdated = "2026-08-10T08:30";
  fireEvent.change(view.getByLabelText(/when did it happen/i), {
    target: { value: backdated },
  });
  fireEvent.click(view.getByRole("button", { name: /post & mark/i }));

  await vi.waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
  expect(mocks.mutate.mock.calls[0]?.[0]).toMatchObject({
    milestone: "labor_started",
    occurredAt: new Date(backdated).getTime(),
  });
});
