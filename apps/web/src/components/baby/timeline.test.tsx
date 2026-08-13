import { fireEvent, render } from "@testing-library/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ComponentProps, ReactElement } from "react";
import { expect, test, vi } from "vitest";
import {
  TimelineFeed,
  TimelineFeedView,
  UpdateComposer,
  UpdateComposerForm,
} from "@/components/baby/timeline";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { makeAsyncResource, makeResource } from "@workspace/convex/convex/test.resource";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import type { BabyData } from "@workspace/convex/src/types";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { LocaleProvider } from "@/lib/i18n";

/** Unreachable deployment URL so smoke tests never dial the local Convex dev port. */
function unreachableConvexClient() {
  return new ConvexReactClient("https://example.convex.cloud", {
    unsavedChangesWarning: false,
  });
}

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
    occurredAt: new Date(backdated).getTime(),
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

type TimelineFeedViewProps = ComponentProps<typeof TimelineFeedView>;

function renderFeedView(overrides: Partial<TimelineFeedViewProps>) {
  const defaults: TimelineFeedViewProps = {
    baby: notYetBaby,
    babyName: notYetBaby.name,
    isOwner: false,
    initialPage: { page: [], isDone: true, continueCursor: "" },
    results: [],
    status: "Exhausted",
    loadMore: vi.fn<(numItems: number) => void>(),
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
    status: "Exhausted",
    results: [
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

test("shows the prefetched first page instead of a spinner while the live query loads", async () => {
  await using feed = renderFeedView({
    status: "LoadingFirstPage",
    results: [],
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
  const view = feed.view;

  expect(view.queryByText("Loading the timeline...")).toBeNull();
  expect(view.getByText("Grandma")).toBeTruthy();
  expect(view.getByText("Can't wait to meet you!")).toBeTruthy();
});

test("shows the empty feed, not a spinner, when the prefetched first page is empty", async () => {
  await using feed = renderFeedView({
    status: "LoadingFirstPage",
    results: [],
    initialPage: { page: [], isDone: true, continueCursor: "" },
  });
  const view = feed.view;

  expect(view.queryByText("Loading the timeline...")).toBeNull();
  expect(view.getByText("Nothing here yet")).toBeTruthy();
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

test("TimelineFeed wires usePaginatedQuery/useMutation into the view", async () => {
  const client = unreachableConvexClient();
  await using _client = makeAsyncResource(client, async () => {
    await client.close();
  });
  const rendered = render(
    <ConvexProvider client={client}>
      <LocaleProvider locale="en-GB">
        <TooltipProvider>
          <TimelineFeed
            babyId={babyId}
            baby={notYetBaby}
            babyName={notYetBaby.name}
            isOwner={false}
            initialPage={{ page: [], isDone: true, continueCursor: "" }}
          />
        </TooltipProvider>
      </LocaleProvider>
    </ConvexProvider>,
  );
  await using view = makeResource(rendered, () => {
    rendered.unmount();
  });
  expect(view.getByText("Nothing here yet")).toBeTruthy();
});
