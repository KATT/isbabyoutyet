import { fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ComponentProps, ReactElement } from "react";
import { expect, test, vi } from "vitest";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";
import { makeAsyncResource, makeResource } from "@workspace/convex/convex/test.resource";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import type { BabyData } from "@workspace/convex/src/types";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { LocaleProvider } from "@/lib/i18n";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { testPreloadedConvexInfiniteQuery } from "@workspace/convex-prefetch/test-helpers";
import type { FunctionReturnType } from "convex/server";
import {
  TimelineFeed,
  TimelineFeedView,
  UpdateComposer,
  UpdateComposerForm,
} from "@/components/baby/timeline";

{
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

/** Unreachable deployment URL so smoke tests never dial a real Convex backend. */
function unreachableConvexClient() {
  return new ConvexReactClient("https://example.invalid", {
    unsavedChangesWarning: false,
  });
}

const notYetBaby: BabyData = {
  name: "Baby Smith",
  timeZone: "Europe/London",
  dueDate: "2026-09-01",
  dueDateDisplayMode: "exact",
  publicDueDateText: null,
  laborStarted: null,
  wentToHospital: null,
  babyBorn: null,
};

const laborStartedBaby: BabyData = {
  ...notYetBaby,
  laborStarted: "2026-08-20T08:00:00.000Z",
};

const babyId = "fake-baby-id" as Id<"baby">;

type UpdateComposerFormProps = ComponentProps<typeof UpdateComposerForm>;

function renderComposerResource(baby: BabyData, locale: SupportedLocale = "en-GB") {
  const postUpdate = vi.fn<UpdateComposerFormProps["postUpdate"]>();
  const generateUploadUrl = vi.fn<UpdateComposerFormProps["generateUploadUrl"]>();
  const withProvider = (currentBaby: BabyData): ReactElement => (
    <LocaleProvider locale={locale}>
      <UpdateComposerForm
        babyId={babyId}
        baby={currentBaby}
        babyName={currentBaby.name}
        onPosted={() => {}}
        postUpdate={postUpdate}
        generateUploadUrl={generateUploadUrl}
      />
    </LocaleProvider>
  );
  const view = render(withProvider(baby));
  return makeResource(
    {
      view,
      postUpdate,
      generateUploadUrl,
      setBaby: (currentBaby: BabyData) => view.rerender(withProvider(currentBaby)),
    },
    () => {
      view.unmount();
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
  expect(view.getByRole("radio", { name: "Förlossningen är igång" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Åkt in till förlossningen" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Bäbisen är född" })).toBeTruthy();
});

test("the composer only offers visible future milestones", async () => {
  await using composer = renderComposerResource({
    ...notYetBaby,
    milestoneVisibility: { showLabor: false, showHospital: true },
    laborStarted: "2026-08-20T08:00:00.000Z",
  });
  const view = composer.view;

  expect(view.queryByRole("radio", { name: "Labour started" })).toBeNull();
  expect(view.getByRole("radio", { name: "Gone to hospital" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Baby born" })).toBeTruthy();
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
  await using composer = renderComposerResource(notYetBaby);
  composer.postUpdate.mockResolvedValue("update-id" as Id<"updates">);
  const view = composer.view;

  fireEvent.click(view.getByRole("radio", { name: "Labour started" }));
  // The picker appears empty (= now) — leave it blank
  const picker = view.getByLabelText(/when did it happen/i) as HTMLInputElement;
  expect(picker.value).toBe("");
  fireEvent.click(view.getByRole("button", { name: /post and mark/i }));

  await vi.waitFor(() => expect(composer.postUpdate).toHaveBeenCalledTimes(1));
  expect(composer.postUpdate.mock.calls[0]?.[0]).toMatchObject({
    babyId,
    milestone: "labor_started",
    occurredAt: undefined,
  });
});

test("a filled event-time picker posts the backdated occurredAt", async () => {
  await using composer = renderComposerResource(notYetBaby);
  composer.postUpdate.mockResolvedValue("update-id" as Id<"updates">);
  const view = composer.view;

  fireEvent.click(view.getByRole("radio", { name: "Labour started" }));
  const backdated = "2026-08-10T08:30";
  fireEvent.change(view.getByLabelText(/when did it happen/i), {
    target: { value: backdated },
  });
  fireEvent.click(view.getByRole("button", { name: /post and mark/i }));

  await vi.waitFor(() => expect(composer.postUpdate).toHaveBeenCalledTimes(1));
  expect(composer.postUpdate.mock.calls[0]?.[0]).toMatchObject({
    babyId,
    milestone: "labor_started",
    occurredAt: Date.parse("2026-08-10T07:30:00.000Z"),
  });
});

test("the composer previews a selected photo and can remove it", async () => {
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  await using _objectUrls = makeResource({}, () => {
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
  await using composer = renderComposerResource(notYetBaby);
  const view = composer.view;

  const fileInput = view.container.querySelector('input[type="file"]');
  if (!fileInput) throw new Error("hidden file input missing");

  fireEvent.change(fileInput, {
    target: { files: [new File(["png"], "baby.png", { type: "image/png" })] },
  });
  expect(view.getByAltText("Photo to post")).toBeTruthy();

  fireEvent.click(view.getByRole("button", { name: "Remove photo" }));
  expect(view.queryByAltText("Photo to post")).toBeNull();
});

test("UpdateComposer wires useMutation into the form", async () => {
  const client = unreachableConvexClient();
  await using _client = makeAsyncResource(client, async () => {
    await client.close();
  });
  const rendered = render(
    <ConvexProvider client={client}>
      <LocaleProvider locale="en-GB">
        <UpdateComposer
          babyId={babyId}
          baby={notYetBaby}
          babyName={notYetBaby.name}
          onPosted={() => {}}
        />
      </LocaleProvider>
    </ConvexProvider>,
  );
  await using view = makeResource(rendered, () => {
    rendered.unmount();
  });
  expect(view.getByText("Post an update")).toBeTruthy();
});

type TimelineFeedViewProps = ComponentProps<typeof TimelineFeedView>;

function renderFeedView(overrides: Partial<TimelineFeedViewProps>) {
  const defaults: TimelineFeedViewProps = {
    publicId: "baby-smith",
    baby: notYetBaby,
    babyName: notYetBaby.name,
    isOwner: false,
    items: [],
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn<TimelineFeedViewProps["fetchNextPage"]>(),
    currentVisitorId: "visitor-1",
    removeUpdate: vi.fn<TimelineFeedViewProps["removeUpdate"]>(),
    setAsCurrentPhoto: vi.fn<TimelineFeedViewProps["setAsCurrentPhoto"]>(),
    removeEncouragement: vi.fn<TimelineFeedViewProps["removeEncouragement"]>(),
    updateEncouragement: vi.fn<TimelineFeedViewProps["updateEncouragement"]>(),
  };
  const props = { ...defaults, ...overrides };
  const rendered = render(
    <LocaleProvider locale="en-GB">
      <TooltipProvider>
        <TimelineFeedView {...props} />
      </TooltipProvider>
    </LocaleProvider>,
  );
  return makeResource({ view: rendered, props }, () => {
    rendered.unmount();
  });
}

test("timeline milestone deletion is disabled while a later status exists", async () => {
  const bornBaby: BabyData = {
    ...laborStartedBaby,
    wentToHospital: "2026-08-20T12:00:00.000Z",
    babyBorn: "2026-08-21T03:00:00.000Z",
  };

  await using feed = renderFeedView({
    baby: bornBaby,
    babyName: bornBaby.name,
    isOwner: true,
    items: [
      {
        _id: "timeline-item-id" as Id<"timelineItems">,
        kind: "update",
        postedAt: Date.now(),
        update: {
          _id: "update-id" as Id<"updates">,
          message: null,
          milestone: "gone_to_hospital",
          occurredAt: Date.now(),
          photoUrl: null,
          thumbnailUrl: null,
          blurDataUrl: null,
          isCurrentPagePhoto: false,
        },
      },
    ],
  });
  const view = feed.view;

  const deleteButton = view.getByRole("button", { name: "Delete update" }) as HTMLButtonElement;
  expect(deleteButton.disabled).toBe(true);
  const tooltipTrigger = deleteButton.closest('[data-slot="tooltip-trigger"]');
  if (!tooltipTrigger) throw new Error("Tooltip trigger missing");
  expect(tooltipTrigger.getAttribute("aria-label")).toBe("Delete the Born status first");
  expect(view.queryByRole("alertdialog")).toBeNull();
});

test("shows the empty feed when there are no items", async () => {
  await using feed = renderFeedView({ items: [] });
  const view = feed.view;

  expect(view.getByText("Nothing here yet")).toBeTruthy();
});

test("renders historical milestone badges regardless of current selection", async () => {
  await using feed = renderFeedView({
    baby: {
      ...notYetBaby,
      milestoneVisibility: { showLabor: false, showHospital: true },
      laborStarted: "2026-08-20T08:00:00.000Z",
    },
    isOwner: false,
    items: [
      {
        _id: "timeline-item-id" as Id<"timelineItems">,
        kind: "update",
        postedAt: Date.now(),
        update: {
          _id: "update-id" as Id<"updates">,
          message: "A family update",
          milestone: "labor_started",
          occurredAt: Date.now(),
          photoUrl: null,
          thumbnailUrl: null,
          blurDataUrl: null,
          isCurrentPagePhoto: false,
        },
      },
    ],
  });
  const view = feed.view;

  expect(view.getByText("A family update")).toBeTruthy();
  expect(view.getByText("Labour started")).toBeTruthy();
});

test("timeline photos link to the update photo overlay", async () => {
  const removeUpdate = vi.fn<TimelineFeedViewProps["removeUpdate"]>();
  const setAsCurrentPhoto = vi.fn<TimelineFeedViewProps["setAsCurrentPhoto"]>();
  const removeEncouragement = vi.fn<TimelineFeedViewProps["removeEncouragement"]>();
  const updateEncouragement = vi.fn<TimelineFeedViewProps["updateEncouragement"]>();
  const fetchNextPage = vi.fn<TimelineFeedViewProps["fetchNextPage"]>();

  await using view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <TimelineFeedView
        publicId="baby-smith"
        baby={notYetBaby}
        babyName={notYetBaby.name}
        isOwner={false}
        items={[
          {
            _id: "timeline-item-id" as Id<"timelineItems">,
            kind: "update",
            postedAt: Date.now(),
            update: {
              _id: "update-photo-id" as Id<"updates">,
              message: "Smile!",
              milestone: null,
              occurredAt: null,
              photoUrl: "https://example.com/full.jpg",
              thumbnailUrl: "https://example.com/thumb.jpg",
              blurDataUrl: "data:image/jpeg;base64,abc",
              isCurrentPagePhoto: false,
            },
          },
        ]}
        hasNextPage={false}
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
        currentVisitorId="visitor-1"
        removeUpdate={removeUpdate}
        setAsCurrentPhoto={setAsCurrentPhoto}
        removeEncouragement={removeEncouragement}
        updateEncouragement={updateEncouragement}
      />
    </LocaleProvider>,
  );

  const photoLink = view.getByRole("link", { name: "View photo full size" });
  expect(photoLink.getAttribute("href")).toBe("/baby/baby-smith/updates/update-photo-id/photo");
  const inline = view.getByAltText("Baby update") as HTMLImageElement;
  expect(inline.src).toContain("thumb.jpg");
});

type TimelinePage = FunctionReturnType<typeof api.timeline.listByBaby>;

function timelineHandle(page: TimelinePage) {
  return testPreloadedConvexInfiniteQuery<typeof api.timeline.listByBaby>({
    input: { babyId },
    numItems: 20,
    initialData: {
      pages: [page],
      pageParams: [{ numItems: 20, cursor: null }],
    },
  });
}

test("TimelineFeed wires the preloaded infinite query and mutations into the view", async () => {
  const client = unreachableConvexClient();
  await using _client = makeAsyncResource(client, async () => {
    await client.close();
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  await using _queryClient = makeResource({}, () => {
    queryClient.clear();
  });
  const handle = timelineHandle({
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
  });

  const rendered = render(
    <ConvexProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider locale="en-GB">
          <TooltipProvider>
            <TimelineFeed
              babyId={babyId}
              publicId="baby-smith"
              baby={notYetBaby}
              babyName={notYetBaby.name}
              isOwner={false}
              timeline={handle}
            />
          </TooltipProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </ConvexProvider>,
  );
  await using view = makeResource(rendered, () => {
    rendered.unmount();
  });

  expect(view.getByText("Grandma")).toBeTruthy();
  expect(view.getByText("Can't wait to meet you!")).toBeTruthy();
});
