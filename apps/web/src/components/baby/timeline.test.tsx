import { fireEvent, render } from "@testing-library/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ComponentProps, ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { TimelineFeed, UpdateComposer } from "@/components/baby/timeline";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import type { BabyData } from "@workspace/convex/src/types";

// Observe what the composer submits: every useMutation hook in the component
// returns this mock (only updates.post is actually invoked in these tests)
const mocks = vi.hoisted(() => ({
  mutate: vi.fn<(args: unknown) => Promise<unknown>>(),
  paginated: {
    results: [] as unknown[],
    status: "Exhausted" as "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted",
    loadMore: vi.fn<(count: number) => void>(),
  },
}));
vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  useMutation: () => mocks.mutate,
  usePaginatedQuery: () => mocks.paginated,
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

test("an empty event-time picker does not post occurredAt", async () => {
  mocks.mutate.mockReset().mockResolvedValue("update-id");
  await using composer = renderComposerResource(notYetBaby);
  const view = composer.view;

  fireEvent.click(view.getByRole("radio", { name: "Labour started" }));
  // The picker appears empty (= now) — leave it blank
  const picker = view.getByLabelText(/when did it happen/i) as HTMLInputElement;
  expect(picker.value).toBe("");
  fireEvent.click(view.getByRole("button", { name: /post & mark/i }));

  await vi.waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
  expect(mocks.mutate.mock.calls[0]?.[0]).toMatchObject({
    milestone: "labor_started",
    occurredAt: undefined,
  });
});

test("a filled event-time picker posts the backdated occurredAt", async () => {
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

test("timeline milestone deletion is disabled while a later status exists", async () => {
  const bornBaby: BabyData = {
    ...laborStartedBaby,
    wentToHospital: "2026-08-20T12:00:00.000Z",
    babyBorn: "2026-08-21T03:00:00.000Z",
  };
  mocks.paginated.status = "Exhausted";
  mocks.paginated.results = [
    {
      _id: "timeline-item-id",
      kind: "update",
      postedAt: Date.now(),
      update: {
        _id: "update-id",
        message: null,
        milestone: "gone_to_hospital",
        occurredAt: Date.now(),
        photoUrl: null,
        thumbnailUrl: null,
        isCurrentPagePhoto: false,
      },
    },
  ];
  const client = new ConvexReactClient("https://example.convex.cloud", {
    unsavedChangesWarning: false,
  });
  const rendered = render(
    <ConvexProvider client={client}>
      <TooltipProvider>
        <TimelineFeed
          babyId={babyId}
          baby={bornBaby}
          babyName={bornBaby.name}
          isOwner
          initialPage={{ page: [], isDone: true, continueCursor: "" }}
        />
      </TooltipProvider>
    </ConvexProvider>,
  );
  await using view = makeResource(rendered, async () => {
    rendered.unmount();
    await client.close();
  });

  const deleteButton = view.getByRole("button", { name: "Delete update" }) as HTMLButtonElement;
  expect(deleteButton.disabled).toBe(true);
  const tooltipTrigger = deleteButton.closest('[data-slot="tooltip-trigger"]');
  if (!tooltipTrigger) throw new Error("Tooltip trigger missing");
  expect(tooltipTrigger.getAttribute("aria-label")).toBe("Delete the Born status first");
  expect(view.queryByRole("alertdialog")).toBeNull();
});

function renderFeed(opts: {
  baby: BabyData;
  isOwner?: boolean;
  initialPage: ComponentProps<typeof TimelineFeed>["initialPage"];
}) {
  const client = new ConvexReactClient("https://example.convex.cloud", {
    unsavedChangesWarning: false,
  });
  const rendered = render(
    <ConvexProvider client={client}>
      <TooltipProvider>
        <TimelineFeed
          babyId={babyId}
          baby={opts.baby}
          babyName={opts.baby.name}
          isOwner={opts.isOwner ?? false}
          initialPage={opts.initialPage}
        />
      </TooltipProvider>
    </ConvexProvider>,
  );
  return makeResource(rendered, async () => {
    rendered.unmount();
    await client.close();
  });
}

test("shows the prefetched first page instead of a spinner while the live query loads", async () => {
  mocks.paginated.results = [];
  mocks.paginated.status = "LoadingFirstPage";

  await using view = renderFeed({
    baby: notYetBaby,
    initialPage: {
      page: [
        {
          _id: "timeline-item-id" as Id<"timelineItems">,
          kind: "encouragement",
          postedAt: Date.now(),
          encouragement: {
            _id: "encouragement-id" as Id<"encouragements">,
            authorName: "Grandma",
            message: "Can't wait to meet you!",
            createdAt: Date.now(),
            isMine: false,
          },
        },
      ],
      isDone: false,
      continueCursor: "cursor",
    },
  });

  expect(view.queryByText("Loading the timeline...")).toBeNull();
  expect(view.getByText("Grandma")).toBeTruthy();
  expect(view.getByText("Can't wait to meet you!")).toBeTruthy();
});

test("shows the empty feed, not a spinner, when the prefetched first page is empty", async () => {
  mocks.paginated.results = [];
  mocks.paginated.status = "LoadingFirstPage";

  await using view = renderFeed({
    baby: notYetBaby,
    initialPage: { page: [], isDone: true, continueCursor: "" },
  });

  expect(view.queryByText("Loading the timeline...")).toBeNull();
  expect(view.getByText("Nothing here yet")).toBeTruthy();
});
