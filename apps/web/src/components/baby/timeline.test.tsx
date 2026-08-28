import { fireEvent, render, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { expect, test, vi } from "vitest";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { BabyData } from "@workspace/convex/src/types";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { isPlainObject } from "@workspace/runtime/guards";
import { CONVEX_INFINITE_QUERY_KEY } from "@workspace/convex-prefetch";
import { LocaleProvider } from "@/lib/i18n";
import { TimelineFeed, UpdateComposer } from "@/components/baby/timeline";
import { EncouragementForm } from "@/components/baby/encouragements";
import { createConvexTestHarness, type ConvexTestHarness } from "@/test/convexTestHarness";
import {
  seedOwnedBaby,
  seedTimelineEncouragement,
  seedTimelineUpdateWithPhoto,
  signUpTestUser,
  storeTestBlob,
} from "@/test/convexTestSeed";
import { renderWithConvexTest } from "@/test/renderWithConvexTest";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";

function isMutationArgsRecord<TArgs>(args: TArgs): args is TArgs & object {
  return isPlainObject(args);
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

const VISITOR_ID_STORAGE_KEY = "encouragement-visitor-id";

async function seedOwnerBaby(harness: ConvexTestHarness) {
  const ownerId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: ownerId });
  return await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
}

function renderComposerTree(
  harness: ConvexTestHarness,
  opts: {
    babyId: Id<"baby">;
    baby: BabyData;
    locale: SupportedLocale;
  },
) {
  return (
    <QueryClientProvider client={harness.queryClient}>
      <ConvexProvider client={harness.convexClient as unknown as ConvexReactClient}>
        <LocaleProvider locale={opts.locale}>
          <UpdateComposer
            babyId={opts.babyId}
            baby={opts.baby}
            babyName={opts.baby.name}
            onPosted={() => {}}
          />
        </LocaleProvider>
      </ConvexProvider>
    </QueryClientProvider>
  );
}

async function renderComposer(
  harness: ConvexTestHarness,
  opts: {
    babyId: Id<"baby">;
    baby: BabyData;
    locale: SupportedLocale | undefined;
  },
) {
  let baby: BabyData = opts.baby;
  const locale = opts.locale ?? "en-GB";
  const view = render(renderComposerTree(harness, { babyId: opts.babyId, baby, locale }));
  const controls: {
    view: ReturnType<typeof render>;
    setBaby: (nextBaby: BabyData) => void;
  } = {
    view,
    setBaby(nextBaby) {
      baby = nextBaby;
      view.rerender(renderComposerTree(harness, { babyId: opts.babyId, baby, locale }));
    },
  };
  return makeResource(controls, () => {
    view.unmount();
  });
}

async function prefetchTimeline(harness: ConvexTestHarness, publicId: string) {
  await harness.queryClient.invalidateQueries({ queryKey: [CONVEX_INFINITE_QUERY_KEY] });
  return await harness.convexPreloader.ensureInfiniteQueryData(api.timeline.listByBaby, {
    args: { babyId: publicId },
    numItems: 20,
  });
}

async function renderTimelineFeed(
  harness: ConvexTestHarness,
  opts: {
    babyId: Id<"baby">;
    publicId: string;
    baby: BabyData;
    isOwner: boolean;
    visitorId: string | undefined;
  },
) {
  if (opts.visitorId) {
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, opts.visitorId);
  } else {
    localStorage.removeItem(VISITOR_ID_STORAGE_KEY);
  }

  const timeline = await prefetchTimeline(harness, opts.publicId);
  return await renderWithTestRouter(
    <QueryClientProvider client={harness.queryClient}>
      <ConvexProvider client={harness.convexClient as unknown as ConvexReactClient}>
        <LocaleProvider locale="en-GB">
          <TimelineFeed
            babyId={opts.babyId}
            publicId={opts.publicId}
            baby={opts.baby}
            babyName={opts.baby.name}
            isOwner={opts.isOwner}
            timeline={timeline}
          />
        </LocaleProvider>
      </ConvexProvider>
    </QueryClientProvider>,
    { path: `/baby/${opts.publicId}` },
  );
}

async function updateRow(view: ReturnType<typeof render>, message: string) {
  const messageNode = await view.findByText(message);
  const row = messageNode.closest(".group");
  if (!row) throw new Error(`Timeline row missing for "${message}"`);
  return within(row as HTMLElement);
}

test("the status radio group is labelled and offers only future stages", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await using composer = await renderComposer(harness, {
    babyId: baby.babyId,
    baby: notYetBaby,
    locale: undefined,
  });
  const view = composer.view;

  const group = view.getByRole("radiogroup", { name: "Status change (optional)" });
  expect(group).toBeTruthy();

  expect(view.getByRole("radio", { name: "No status change" }).getAttribute("aria-checked")).toBe(
    "true",
  );
  expect(view.getByRole("radio", { name: "Labour started" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Gone to hospital" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Baby born" })).toBeTruthy();

  composer.setBaby(laborStartedBaby);
  expect(view.queryByRole("radio", { name: "Labour started" })).toBeNull();
  expect(view.getByRole("radio", { name: "Gone to hospital" })).toBeTruthy();
});

test("the milestone metadata resolves through the Swedish catalog", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await using composer = await renderComposer(harness, {
    babyId: baby.babyId,
    baby: notYetBaby,
    locale: "sv",
  });
  const view = composer.view;

  expect(view.getByRole("radiogroup", { name: "Statusändring (valfritt)" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Ingen statusändring" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Förlossningen är igång" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Åkt in till förlossningen" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Bäbisen är född" })).toBeTruthy();
});

test("the composer only offers visible future milestones", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await using composer = await renderComposer(harness, {
    babyId: baby.babyId,
    baby: {
      ...notYetBaby,
      milestoneVisibility: { showLabor: false, showHospital: true },
      laborStarted: "2026-08-20T08:00:00.000Z",
    },
    locale: undefined,
  });
  const view = composer.view;

  expect(view.queryByRole("radio", { name: "Labour started" })).toBeNull();
  expect(view.getByRole("radio", { name: "Gone to hospital" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Baby born" })).toBeTruthy();
});

test("a stale milestone selection is cleared when the status advances elsewhere", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await using composer = await renderComposer(harness, {
    babyId: baby.babyId,
    baby: notYetBaby,
    locale: undefined,
  });
  const view = composer.view;

  fireEvent.click(view.getByRole("radio", { name: "Labour started" }));
  expect(view.getByRole("radio", { name: "Labour started" }).getAttribute("aria-checked")).toBe(
    "true",
  );

  composer.setBaby(laborStartedBaby);
  expect(view.getByRole("radio", { name: "No status change" }).getAttribute("aria-checked")).toBe(
    "true",
  );

  composer.setBaby(notYetBaby);
  expect(view.getByRole("radio", { name: "Labour started" }).getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(view.getByRole("radio", { name: "No status change" }).getAttribute("aria-checked")).toBe(
    "true",
  );
});

test("an empty event-time picker does not post occurredAt", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await using composer = await renderComposer(harness, {
    babyId: baby.babyId,
    baby: notYetBaby,
    locale: undefined,
  });
  const view = composer.view;
  const postedBefore = Date.now();

  fireEvent.click(view.getByRole("radio", { name: "Labour started" }));
  const picker = view.getByLabelText(/when did it happen/i) as HTMLInputElement;
  expect(picker.value).toBe("");
  fireEvent.click(view.getByRole("button", { name: /post and mark/i }));

  await vi.waitFor(async () => {
    const feed = await harness.client.query(api.timeline.listByBaby, {
      babyId: baby.publicId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    const milestoneUpdate = feed.page.find(
      (item) => item.kind === "update" && item.update.milestone === "labor_started",
    );
    if (milestoneUpdate?.kind !== "update") throw new Error("expected milestone update");
    expect(milestoneUpdate.update.occurredAt).toBeGreaterThanOrEqual(postedBefore);
    expect(milestoneUpdate.update.occurredAt).toBeLessThanOrEqual(Date.now() + 60_000);
  });
});

test("a filled event-time picker posts the backdated occurredAt", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await using composer = await renderComposer(harness, {
    babyId: baby.babyId,
    baby: notYetBaby,
    locale: undefined,
  });
  const view = composer.view;

  fireEvent.click(view.getByRole("radio", { name: "Labour started" }));
  fireEvent.change(view.getByLabelText(/when did it happen/i), {
    target: { value: "2026-08-10T08:30" },
  });
  fireEvent.click(view.getByRole("button", { name: /post and mark/i }));

  await vi.waitFor(async () => {
    const feed = await harness.client.query(api.timeline.listByBaby, {
      babyId: baby.publicId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    const milestoneUpdate = feed.page.find(
      (item) => item.kind === "update" && item.update.milestone === "labor_started",
    );
    if (milestoneUpdate?.kind !== "update") throw new Error("expected milestone update");
    expect(milestoneUpdate.update.occurredAt).toBe(Date.parse("2026-08-10T07:30:00.000Z"));
  });
});

test("the composer previews a selected photo and can remove it", async () => {
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  await using _objectUrls = makeResource({}, () => {
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await using composer = await renderComposer(harness, {
    babyId: baby.babyId,
    baby: notYetBaby,
    locale: undefined,
  });
  const view = composer.view;

  const fileInput = view.container.querySelector('input[type="file"]');
  if (!fileInput) throw new Error("hidden file input missing");

  fireEvent.change(fileInput, {
    target: { files: [new File(["png"], "baby.png", { type: "image/png" })] },
  });
  await vi.waitFor(() => {
    expect(view.getByAltText("Photo to post")).toBeTruthy();
  });

  fireEvent.click(view.getByRole("button", { name: "Remove photo" }));
  expect(view.queryByAltText("Photo to post")).toBeNull();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview");
});

test("timeline milestone deletion is disabled while a later status exists", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await harness.client.mutation(api.updates.post, {
    babyId: baby.babyId,
    milestone: "labor_started",
  });
  await harness.client.mutation(api.updates.post, {
    babyId: baby.babyId,
    milestone: "gone_to_hospital",
  });
  await harness.client.mutation(api.updates.post, {
    babyId: baby.babyId,
    milestone: "born",
  });

  await using feed = await renderTimelineFeed(harness, {
    babyId: baby.babyId,
    publicId: baby.publicId,
    baby: {
      ...laborStartedBaby,
      wentToHospital: "2026-08-20T12:00:00.000Z",
      babyBorn: "2026-08-21T03:00:00.000Z",
    },
    isOwner: true,
    visitorId: undefined,
  });

  const blockedDeleteButtons = feed
    .getAllByRole("button", { name: "Delete update" })
    .filter((button) => (button as HTMLButtonElement).disabled);
  expect(blockedDeleteButtons.length).toBeGreaterThan(0);
  const deleteButton = blockedDeleteButtons[0] as HTMLButtonElement;
  const tooltipTrigger = deleteButton.closest('[data-slot="tooltip-trigger"]');
  if (!tooltipTrigger) throw new Error("Tooltip trigger missing");
  expect(tooltipTrigger.getAttribute("aria-label")).toBe("Delete the Born status first");
  expect(feed.queryByRole("alertdialog")).toBeNull();
});

test("shows the loaded first page instead of a spinner while the live query syncs", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await seedTimelineEncouragement(harness, {
    babyId: baby.babyId,
    authorName: "Grandma",
    message: "Can't wait to meet you!",
  });

  await using feed = await renderTimelineFeed(harness, {
    babyId: baby.babyId,
    publicId: baby.publicId,
    baby: notYetBaby,
    isOwner: false,
    visitorId: undefined,
  });

  expect(feed.queryByText("Loading the timeline...")).toBeNull();
  expect(feed.getByText("Grandma")).toBeTruthy();
  expect(feed.getByText("Can't wait to meet you!")).toBeTruthy();
});

test("shows the empty feed, not a spinner, when the loaded first page is empty", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await using feed = await renderTimelineFeed(harness, {
    babyId: baby.babyId,
    publicId: baby.publicId,
    baby: notYetBaby,
    isOwner: false,
    visitorId: undefined,
  });

  expect(feed.queryByText("Loading the timeline...")).toBeNull();
  expect(feed.getByText("Nothing here yet")).toBeTruthy();
});

test("renders historical milestone badges regardless of current selection", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await harness.client.mutation(api.updates.post, {
    babyId: baby.babyId,
    message: "A family update",
    milestone: "labor_started",
  });

  await using feed = await renderTimelineFeed(harness, {
    babyId: baby.babyId,
    publicId: baby.publicId,
    baby: {
      ...notYetBaby,
      milestoneVisibility: { showLabor: false, showHospital: true },
      laborStarted: "2026-08-20T08:00:00.000Z",
    },
    isOwner: false,
    visitorId: undefined,
  });

  expect(feed.getByText("A family update")).toBeTruthy();
  expect(feed.getByText("Labour started")).toBeTruthy();
});

test("timeline photos link to the update photo overlay", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  const seeded = await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Smile!",
  });

  await using feed = await renderTimelineFeed(harness, {
    babyId: baby.babyId,
    publicId: baby.publicId,
    baby: notYetBaby,
    isOwner: false,
    visitorId: undefined,
  });

  const photoLink = feed.getByRole("link", { name: "View photo full size" });
  expect(photoLink.getAttribute("href")).toBe(
    `/baby/${baby.publicId}/updates/${seeded.updateId}/photo`,
  );
  const inline = feed.getByAltText("Baby update") as HTMLImageElement;
  expect(inline.src).toContain("http");
});

test("owners can delete an encouragement and toast success", async () => {
  const toastSuccess = vi.spyOn((await import("sonner")).toast, "success");
  await using _toast = makeResource({}, () => {
    toastSuccess.mockRestore();
  });
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await seedTimelineEncouragement(harness, {
    babyId: baby.babyId,
    authorName: "Grandma",
    message: "Can't wait!",
  });

  await using feed = await renderTimelineFeed(harness, {
    babyId: baby.babyId,
    publicId: baby.publicId,
    baby: notYetBaby,
    isOwner: true,
    visitorId: undefined,
  });

  fireEvent.click(feed.getByRole("button", { name: "Delete message" }));
  fireEvent.click(feed.getByRole("button", { name: "Delete" }));

  await vi.waitFor(() => {
    expect(toastSuccess).toHaveBeenCalledWith("Message deleted");
  });
  const timeline = await harness.client.query(api.timeline.listByBaby, {
    babyId: baby.publicId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(timeline.page.some((item) => item.kind === "encouragement")).toBe(false);
});

test("authors can edit their own encouragement within the edit window", async () => {
  const toastSuccess = vi.spyOn((await import("sonner")).toast, "success");
  await using _toast = makeResource({}, () => {
    toastSuccess.mockRestore();
  });
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await harness.client.mutation(api.encouragements.create, {
    babyId: baby.babyId,
    authorName: "Me",
    message: "Original message",
    visitorId: "visitor-1",
  });

  await using feed = await renderTimelineFeed(harness, {
    babyId: baby.babyId,
    publicId: baby.publicId,
    baby: notYetBaby,
    isOwner: false,
    visitorId: "visitor-1",
  });

  await vi.waitFor(() => {
    expect(feed.getByRole("button", { name: "Edit message" })).toBeTruthy();
  });
  fireEvent.click(feed.getByRole("button", { name: "Edit message" }));
  const textarea = feed.getByLabelText("Edit your message");
  fireEvent.change(textarea, { target: { value: "Updated message" } });
  fireEvent.click(feed.getByRole("button", { name: "Save" }));

  await vi.waitFor(() => {
    expect(toastSuccess).toHaveBeenCalledWith("Message updated");
  });
  const timeline = await harness.client.query(api.timeline.listByBaby, {
    babyId: baby.publicId,
    paginationOpts: { numItems: 20, cursor: null },
    visitorId: "visitor-1",
  });
  expect(
    timeline.page.some(
      (item) => item.kind === "encouragement" && item.encouragement?.message === "Updated message",
    ),
  ).toBe(true);
});

test("update delete and set-as-photo handlers toast on success and error", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);
  await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Smile!",
  });
  const toast = (await import("sonner")).toast;
  const toastSuccess = vi.spyOn(toast, "success");
  const toastError = vi.spyOn(toast, "error");
  await using _toast = makeResource({}, () => {
    toastSuccess.mockRestore();
    toastError.mockRestore();
  });

  {
    await using feed = await renderTimelineFeed(harness, {
      babyId: baby.babyId,
      publicId: baby.publicId,
      baby: notYetBaby,
      isOwner: true,
      visitorId: undefined,
    });
    fireEvent.click(feed.getByRole("button", { name: "Delete update" }));
    fireEvent.click(feed.getByRole("button", { name: /^Delete$/i }));
    await vi.waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Update removed");
    });
    const afterDelete = await harness.client.query(api.timeline.listByBaby, {
      babyId: baby.publicId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(afterDelete.page.some((item) => item.kind === "update")).toBe(false);
  }

  await harness.client.mutation(api.baby.updatePhoto, {
    babyId: baby.babyId,
    photoId: await storeTestBlob(harness),
  });
  await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Second photo",
  });
  {
    await using feed = await renderTimelineFeed(harness, {
      babyId: baby.babyId,
      publicId: baby.publicId,
      baby: notYetBaby,
      isOwner: true,
      visitorId: undefined,
    });
    await vi.waitFor(() => {
      expect(feed.getByRole("button", { name: "Set as page photo" })).toBeTruthy();
    });
    fireEvent.click(feed.getByRole("button", { name: "Set as page photo" }));
    await vi.waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Page photo updated");
    });
  }

  await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Delete me",
  });
  const originalMutation = harness.convexClient.mutation.bind(harness.convexClient);
  const mutationSpy = vi
    .spyOn(harness.convexClient, "mutation")
    .mockImplementation(async (mutation, args) => {
      if (isMutationArgsRecord(args) && "updateId" in args && !("encouragementId" in args)) {
        throw new Error("nope");
      }
      return await originalMutation(mutation, args);
    });
  await using _mutationSpy = makeResource({}, () => {
    mutationSpy.mockRestore();
  });

  {
    await using feed = await renderTimelineFeed(harness, {
      babyId: baby.babyId,
      publicId: baby.publicId,
      baby: notYetBaby,
      isOwner: true,
      visitorId: undefined,
    });
    const row = await updateRow(feed, "Delete me");
    fireEvent.click(row.getByRole("button", { name: "Delete update" }));
    fireEvent.click(feed.getByRole("button", { name: /^Delete$/i }));
    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("nope");
    });
  }

  mutationSpy.mockRestore();
  await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Pin fail",
  });
  vi.spyOn(harness.convexClient, "mutation").mockImplementation(async (mutation, args) => {
    if (isMutationArgsRecord(args) && "updateId" in args && !("encouragementId" in args)) {
      throw new Error("offline");
    }
    return await originalMutation(mutation, args);
  });

  {
    await using feed = await renderTimelineFeed(harness, {
      babyId: baby.babyId,
      publicId: baby.publicId,
      baby: notYetBaby,
      isOwner: true,
      visitorId: undefined,
    });
    await vi.waitFor(() => {
      expect(feed.getAllByRole("button", { name: "Set as page photo" }).length).toBeGreaterThan(0);
    });
    fireEvent.click(feed.getAllByRole("button", { name: "Set as page photo" })[0]!);
    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("offline");
    });
  }
});

test("EncouragementForm mounts through the Convex provider", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);

  await using view = renderWithConvexTest({
    harness,
    ui: <EncouragementForm babyId={baby.babyId} babyName={notYetBaby.name} />,
    wrap: null,
  });

  expect(view.getAllByText("Send some love").length).toBeGreaterThan(0);
  expect(view.getByLabelText("Your name")).toBeTruthy();
  expect(view.getByLabelText("Message")).toBeTruthy();
});

test("EncouragementForm submit reaches the Convex mutation", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const baby = await seedOwnerBaby(harness);

  await using view = renderWithConvexTest({
    harness,
    ui: <EncouragementForm babyId={baby.babyId} babyName={notYetBaby.name} />,
    wrap: null,
  });

  fireEvent.change(view.getByLabelText("Your name"), { target: { value: "Auntie Jo" } });
  fireEvent.change(view.getByLabelText("Message"), { target: { value: "Thinking of you!" } });
  fireEvent.click(view.getByRole("button", { name: "Send some love" }));

  await vi.waitFor(
    () => {
      expect(
        (view.getByRole("button", { name: "Send some love" }) as HTMLButtonElement).disabled,
      ).toBe(false);
    },
    // Form DEV delay (500ms) + encouragement toast DEV delay (1000ms)
    { timeout: 5000 },
  );

  const feed = await harness.client.query(api.timeline.listByBaby, {
    babyId: baby.publicId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(
    feed.page.some(
      (item) => item.kind === "encouragement" && item.encouragement?.message === "Thinking of you!",
    ),
  ).toBe(true);
});
