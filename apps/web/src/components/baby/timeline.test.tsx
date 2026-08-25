import { fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ComponentProps, ReactElement } from "react";
import { expect, test, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";
import { makeAsyncResource, makeResource } from "@workspace/convex/convex/test.resource";
import type { BabyData } from "@workspace/convex/src/types";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { testPreloadedConvexInfiniteQuery } from "@workspace/convex-prefetch/test-helpers";
import { LocaleProvider } from "@/lib/i18n";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import {
  TimelineFeed,
  TimelineFeedView,
  UpdateComposer,
  UpdateComposerForm,
} from "@/components/baby/timeline";
import { EncouragementForm } from "@/components/baby/encouragements";

/** Unreachable deployment URL so smoke renders never dial a real backend. */
function convexClientResource() {
  const client = new ConvexReactClient("https://example.invalid", {
    unsavedChangesWarning: false,
  });
  return makeAsyncResource(client, async () => {
    await client.close();
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
const publicId = "baby-smith";

// --- Composer: the two mutations arrive as props, so no Convex provider ---

type UpdateComposerFormProps = ComponentProps<typeof UpdateComposerForm>;

function renderComposerResource(baby: BabyData, locale: SupportedLocale = "en-GB") {
  const postUpdate = vi.fn<UpdateComposerFormProps["postUpdate"]>();
  const generateUploadUrl = vi.fn<UpdateComposerFormProps["generateUploadUrl"]>();
  const withBaby = (currentBaby: BabyData): ReactElement => (
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
  const view = render(withBaby(baby));
  /** Re-render as if the status advanced in another tab. */
  function setBaby(currentBaby: BabyData) {
    view.rerender(withBaby(currentBaby));
  }
  return makeResource({ view, postUpdate, generateUploadUrl, setBaby }, () => {
    view.unmount();
  });
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
  fireEvent.change(view.getByLabelText(/when did it happen/i), {
    target: { value: "2026-08-10T08:30" },
  });
  fireEvent.click(view.getByRole("button", { name: /post and mark/i }));

  await vi.waitFor(() => expect(composer.postUpdate).toHaveBeenCalledTimes(1));
  expect(composer.postUpdate.mock.calls[0]?.[0]).toMatchObject({
    babyId,
    milestone: "labor_started",
    // 08:30 in the baby's Europe/London summer time
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

// --- Feed: loaded items, pagination state and mutations arrive as props ---

type TimelineFeedViewProps = ComponentProps<typeof TimelineFeedView>;
type TimelineItem = TimelineFeedViewProps["items"][number];

async function renderFeedView(overrides: Partial<TimelineFeedViewProps>) {
  const defaults: TimelineFeedViewProps = {
    publicId,
    baby: notYetBaby,
    babyName: notYetBaby.name,
    isOwner: false,
    items: [],
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn<() => unknown>(),
    currentVisitorId: "visitor-1",
    removeUpdate: vi.fn<TimelineFeedViewProps["removeUpdate"]>(),
    setAsCurrentPhoto: vi.fn<TimelineFeedViewProps["setAsCurrentPhoto"]>(),
    removeEncouragement: vi.fn<TimelineFeedViewProps["removeEncouragement"]>(),
    updateEncouragement: vi.fn<TimelineFeedViewProps["updateEncouragement"]>(),
  };
  return await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <TimelineFeedView {...defaults} {...overrides} />
    </LocaleProvider>,
  );
}

function updateItem(update: Partial<Extract<TimelineItem, { kind: "update" }>["update"]>) {
  return {
    _id: "timeline-item-id" as Id<"timelineItems">,
    kind: "update",
    postedAt: Date.now(),
    update: {
      _id: "update-id" as Id<"updates">,
      message: null,
      milestone: null,
      occurredAt: null,
      photoUrl: null,
      thumbnailUrl: null,
      blurDataUrl: null,
      isCurrentPagePhoto: false,
      ...update,
    },
  } satisfies TimelineItem;
}

test("timeline milestone deletion is disabled while a later status exists", async () => {
  await using view = await renderFeedView({
    baby: {
      ...laborStartedBaby,
      wentToHospital: "2026-08-20T12:00:00.000Z",
      babyBorn: "2026-08-21T03:00:00.000Z",
    },
    isOwner: true,
    items: [updateItem({ milestone: "gone_to_hospital", occurredAt: Date.now() })],
  });

  const deleteButton = view.getByRole("button", { name: "Delete update" }) as HTMLButtonElement;
  expect(deleteButton.disabled).toBe(true);
  const tooltipTrigger = deleteButton.closest('[data-slot="tooltip-trigger"]');
  if (!tooltipTrigger) throw new Error("Tooltip trigger missing");
  expect(tooltipTrigger.getAttribute("aria-label")).toBe("Delete the Born status first");
  expect(view.queryByRole("alertdialog")).toBeNull();
});

test("shows the loaded first page instead of a spinner while the live query syncs", async () => {
  await using view = await renderFeedView({
    items: [
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
    hasNextPage: true,
  });

  expect(view.queryByText("Loading the timeline...")).toBeNull();
  expect(view.getByText("Grandma")).toBeTruthy();
  expect(view.getByText("Can't wait to meet you!")).toBeTruthy();
});

test("shows the empty feed, not a spinner, when the loaded first page is empty", async () => {
  await using view = await renderFeedView({});

  expect(view.queryByText("Loading the timeline...")).toBeNull();
  expect(view.getByText("Nothing here yet")).toBeTruthy();
});

test("renders historical milestone badges regardless of current selection", async () => {
  await using view = await renderFeedView({
    baby: {
      ...notYetBaby,
      milestoneVisibility: { showLabor: false, showHospital: true },
      laborStarted: "2026-08-20T08:00:00.000Z",
    },
    items: [
      updateItem({
        message: "A family update",
        milestone: "labor_started",
        occurredAt: Date.now(),
      }),
    ],
  });

  expect(view.getByText("A family update")).toBeTruthy();
  expect(view.getByText("Labour started")).toBeTruthy();
});

test("timeline photos link to the update photo overlay", async () => {
  await using view = await renderFeedView({
    items: [
      updateItem({
        _id: "update-photo-id" as Id<"updates">,
        message: "Smile!",
        photoUrl: "https://example.com/full.jpg",
        thumbnailUrl: "https://example.com/thumb.jpg",
        blurDataUrl: "data:image/jpeg;base64,abc",
      }),
    ],
  });

  const photoLink = view.getByRole("link", { name: "View photo full size" });
  expect(photoLink.getAttribute("href")).toBe(`/baby/${publicId}/updates/update-photo-id/photo`);
  const inline = view.getByAltText("Baby update") as HTMLImageElement;
  expect(inline.src).toContain("thumb.jpg");
});

// --- Container smoke tests: the real Convex hooks feed the views ---

test("UpdateComposer wires the Convex mutations into the form", async () => {
  await using client = convexClientResource();
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
  expect(view.getByRole("radiogroup", { name: "Status change (optional)" })).toBeTruthy();
});

type TimelinePage = FunctionReturnType<typeof api.timeline.listByBaby>;

test("TimelineFeed renders the prefetched page through the live query", async () => {
  await using client = convexClientResource();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await using _queryClient = makeResource(queryClient, () => {
    queryClient.clear();
  });
  const page: TimelinePage = {
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
    isDone: true,
    continueCursor: "",
  };

  await using view = await renderWithTestRouter(
    <QueryClientProvider client={queryClient}>
      <ConvexProvider client={client}>
        <LocaleProvider locale="en-GB">
          <TimelineFeed
            babyId={babyId}
            publicId={publicId}
            baby={notYetBaby}
            babyName={notYetBaby.name}
            isOwner={false}
            timeline={testPreloadedConvexInfiniteQuery<typeof api.timeline.listByBaby>({
              input: { babyId },
              numItems: 20,
              initialData: { pages: [page], pageParams: [{ numItems: 20, cursor: null }] },
            })}
          />
        </LocaleProvider>
      </ConvexProvider>
    </QueryClientProvider>,
  );

  expect(view.getByText("Grandma")).toBeTruthy();
  expect(view.getByText("Can't wait to meet you!")).toBeTruthy();
});

test("owners can delete an encouragement and toast success", async () => {
  const removeEncouragement = vi
    .fn<TimelineFeedViewProps["removeEncouragement"]>()
    .mockResolvedValue(null);
  const toastSuccess = vi.spyOn((await import("sonner")).toast, "success");
  await using _toast = makeResource({}, () => {
    toastSuccess.mockRestore();
  });

  await using view = await renderFeedView({
    isOwner: true,
    removeEncouragement,
    items: [
      {
        _id: "timeline-enc-id" as Id<"timelineItems">,
        kind: "encouragement",
        postedAt: Date.now(),
        encouragement: {
          _id: "encouragement-id" as Id<"encouragements">,
          authorName: "Grandma",
          message: "Can't wait!",
          createdAt: Date.now(),
          isMine: false,
        },
      },
    ],
  });

  fireEvent.click(view.getByRole("button", { name: "Delete message" }));
  fireEvent.click(view.getByRole("button", { name: "Delete" }));

  await vi.waitFor(() => {
    expect(removeEncouragement).toHaveBeenCalledWith({
      encouragementId: "encouragement-id",
      visitorId: undefined,
    });
  });
  expect(toastSuccess).toHaveBeenCalledWith("Message deleted");
});

test("authors can edit their own encouragement within the edit window", async () => {
  const updateEncouragement = vi
    .fn<TimelineFeedViewProps["updateEncouragement"]>()
    .mockResolvedValue(null);
  const toastSuccess = vi.spyOn((await import("sonner")).toast, "success");
  await using _toast = makeResource({}, () => {
    toastSuccess.mockRestore();
  });

  await using view = await renderFeedView({
    currentVisitorId: "visitor-1",
    updateEncouragement,
    items: [
      {
        _id: "timeline-enc-id" as Id<"timelineItems">,
        kind: "encouragement",
        postedAt: Date.now(),
        encouragement: {
          _id: "encouragement-id" as Id<"encouragements">,
          authorName: "Me",
          message: "Original message",
          createdAt: Date.now(),
          isMine: true,
        },
      },
    ],
  });

  fireEvent.click(view.getByRole("button", { name: "Edit message" }));
  const textarea = view.getByLabelText("Edit your message");
  fireEvent.change(textarea, { target: { value: "Updated message" } });
  fireEvent.click(view.getByRole("button", { name: "Save" }));

  await vi.waitFor(() => {
    expect(updateEncouragement).toHaveBeenCalledWith({
      encouragementId: "encouragement-id",
      visitorId: "visitor-1",
      message: "Updated message",
    });
  });
  expect(toastSuccess).toHaveBeenCalledWith("Message updated");
});

test("update delete and set-as-photo handlers toast on success and error", async () => {
  const removeUpdate = vi
    .fn<TimelineFeedViewProps["removeUpdate"]>()
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(new Error("nope"));
  const setAsCurrentPhoto = vi
    .fn<TimelineFeedViewProps["setAsCurrentPhoto"]>()
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce("offline");
  const toast = (await import("sonner")).toast;
  const toastSuccess = vi.spyOn(toast, "success");
  const toastError = vi.spyOn(toast, "error");
  await using _toast = makeResource({}, () => {
    toastSuccess.mockRestore();
    toastError.mockRestore();
  });

  const photoUpdate = updateItem({
    _id: "update-photo-id" as Id<"updates">,
    message: "Smile!",
    photoUrl: "https://example.com/full.jpg",
    thumbnailUrl: "https://example.com/thumb.jpg",
    blurDataUrl: null,
  });

  {
    await using deleteOk = await renderFeedView({
      isOwner: true,
      removeUpdate,
      items: [photoUpdate],
    });
    fireEvent.click(deleteOk.getByRole("button", { name: "Delete update" }));
    fireEvent.click(deleteOk.getByRole("button", { name: /^Delete$/i }));
    await vi.waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Update removed");
    });
  }

  {
    await using pinOk = await renderFeedView({
      isOwner: true,
      setAsCurrentPhoto,
      items: [photoUpdate],
    });
    fireEvent.click(pinOk.getByRole("button", { name: "Set as page photo" }));
    await vi.waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Page photo updated");
    });
  }

  {
    await using deleteFail = await renderFeedView({
      isOwner: true,
      removeUpdate,
      items: [photoUpdate],
    });
    fireEvent.click(deleteFail.getByRole("button", { name: "Delete update" }));
    fireEvent.click(deleteFail.getByRole("button", { name: /^Delete$/i }));
    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("nope");
    });
  }

  {
    await using pinFail = await renderFeedView({
      isOwner: true,
      setAsCurrentPhoto,
      items: [photoUpdate],
    });
    fireEvent.click(pinFail.getByRole("button", { name: "Set as page photo" }));
    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Failed to set page photo");
    });
  }
});

test("EncouragementForm mounts through the Convex provider", async () => {
  await using client = convexClientResource();
  const rendered = render(
    <ConvexProvider client={client}>
      <LocaleProvider locale="en-GB">
        <EncouragementForm babyId={babyId} babyName={notYetBaby.name} />
      </LocaleProvider>
    </ConvexProvider>,
  );
  await using view = makeResource(rendered, () => {
    rendered.unmount();
  });

  expect(view.getAllByText("Send some love").length).toBeGreaterThan(0);
  expect(view.getByLabelText("Your name")).toBeTruthy();
  expect(view.getByLabelText("Message")).toBeTruthy();
});

test("EncouragementForm submit reaches the Convex mutation", async () => {
  await using client = convexClientResource();
  const rendered = render(
    <ConvexProvider client={client}>
      <LocaleProvider locale="en-GB">
        <EncouragementForm babyId={babyId} babyName={notYetBaby.name} />
      </LocaleProvider>
    </ConvexProvider>,
  );
  await using view = makeResource(rendered, () => {
    rendered.unmount();
  });

  fireEvent.change(view.getByLabelText("Your name"), { target: { value: "Auntie Jo" } });
  fireEvent.change(view.getByLabelText("Message"), { target: { value: "Thinking of you!" } });
  fireEvent.click(view.getByRole("button", { name: "Send some love" }));

  // Mutation against the unreachable client rejects; assert the form settles.
  await vi.waitFor(() => {
    expect(
      (view.getByRole("button", { name: "Send some love" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
