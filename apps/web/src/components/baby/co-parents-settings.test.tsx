import { fireEvent, render } from "@testing-library/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { makeAsyncResource, makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import {
  CoParentsSettings,
  CoParentsSettingsView,
  type CoParentsListing,
} from "@/components/baby/co-parents-settings";

const babyId = "jd7baby000000000000000000" as Id<"baby">;
const coParentId = "jd7coparent00000000000000" as Id<"babyCoParents">;
const inviteId = "jd7invite0000000000000000" as Id<"babyCoParentInvites">;

function resolvedInvite() {
  return vi
    .fn<(args: { babyId: Id<"baby">; email: string }) => Promise<{ status: "added" | "invited" }>>()
    .mockResolvedValue({ status: "added" });
}

function resolvedVoid<TArg>() {
  return vi.fn<(arg: TArg) => Promise<unknown>>().mockResolvedValue(null);
}

function rejectedVoid<TArg>(message: string) {
  return vi.fn<(arg: TArg) => Promise<unknown>>().mockRejectedValue(new Error(message));
}

function renderResource(ui: React.ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

/** Unreachable deployment URL so smoke tests never dial a real Convex backend. */
function unreachableConvexClient() {
  return new ConvexReactClient("https://example.invalid", {
    unsavedChangesWarning: false,
  });
}

test("CoParentsSettings wires useQuery/useMutation into the view", async () => {
  const client = unreachableConvexClient();
  await using _client = makeAsyncResource(client, async () => {
    await client.close();
  });
  const rendered = render(
    <ConvexProvider client={client}>
      <CoParentsSettings babyId={babyId} isOwner={true} />
    </ConvexProvider>,
  );
  await using view = makeResource(rendered, () => {
    rendered.unmount();
  });
  expect(view.getByText(/Loading co-parents/i)).toBeTruthy();
});

test("owner can invite a co-parent by email", async () => {
  const onInvite = resolvedInvite();
  const listing: CoParentsListing = { coParents: [], invites: [] };

  await using view = renderResource(
    <CoParentsSettingsView
      babyId={babyId}
      isOwner={true}
      listing={listing}
      onInvite={onInvite}
      onRemoveCoParent={resolvedVoid<{ coParentId: Id<"babyCoParents"> }>()}
      onCancelInvite={resolvedVoid<{ inviteId: Id<"babyCoParentInvites"> }>()}
    />,
  );

  expect(view.getByText(/No co-parents yet/)).toBeTruthy();
  fireEvent.change(view.getByPlaceholderText("partner@example.com"), {
    target: { value: "partner@example.com" },
  });
  fireEvent.click(view.getByRole("button", { name: "Add" }));

  await vi.waitFor(() => {
    expect(onInvite).toHaveBeenCalledWith({
      babyId,
      email: "partner@example.com",
    });
  });
});

test("lists co-parents and pending invites; owner can remove them", async () => {
  const onRemoveCoParent = resolvedVoid<{ coParentId: Id<"babyCoParents"> }>();
  const onCancelInvite = resolvedVoid<{ inviteId: Id<"babyCoParentInvites"> }>();

  const listing: CoParentsListing = {
    coParents: [
      {
        _id: coParentId,
        email: "bob@example.com",
        name: "Bob",
        userId: "bob",
        addedAt: Date.now(),
      },
    ],
    invites: [
      {
        _id: inviteId,
        email: "new@example.com",
        createdAt: Date.now(),
      },
    ],
  };

  await using view = renderResource(
    <CoParentsSettingsView
      babyId={babyId}
      isOwner={true}
      listing={listing}
      onInvite={resolvedInvite()}
      onRemoveCoParent={onRemoveCoParent}
      onCancelInvite={onCancelInvite}
    />,
  );

  expect(view.getByText("Bob")).toBeTruthy();
  expect(view.getByText("Invite pending")).toBeTruthy();

  fireEvent.click(view.getByRole("button", { name: "Remove bob@example.com" }));
  await vi.waitFor(() => {
    expect(onRemoveCoParent).toHaveBeenCalledWith({ coParentId });
  });

  fireEvent.click(view.getByRole("button", { name: "Cancel invite to new@example.com" }));
  await vi.waitFor(() => {
    expect(onCancelInvite).toHaveBeenCalledWith({ inviteId });
  });
});

test("surfaces errors when remove or cancel invite fails", async () => {
  const onRemoveCoParent = rejectedVoid<{ coParentId: Id<"babyCoParents"> }>("remove failed");
  const onCancelInvite = rejectedVoid<{ inviteId: Id<"babyCoParentInvites"> }>("cancel failed");
  const toastError = vi.spyOn(toast, "error");
  await using _toast = makeResource({}, () => {
    toastError.mockRestore();
  });

  const listing: CoParentsListing = {
    coParents: [
      {
        _id: coParentId,
        email: "bob@example.com",
        name: "Bob",
        userId: "bob",
        addedAt: Date.now(),
      },
    ],
    invites: [
      {
        _id: inviteId,
        email: "new@example.com",
        createdAt: Date.now(),
      },
    ],
  };

  await using view = renderResource(
    <CoParentsSettingsView
      babyId={babyId}
      isOwner={true}
      listing={listing}
      onInvite={resolvedInvite()}
      onRemoveCoParent={onRemoveCoParent}
      onCancelInvite={onCancelInvite}
    />,
  );

  fireEvent.click(view.getByRole("button", { name: "Remove bob@example.com" }));
  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith("remove failed");
  });

  fireEvent.click(view.getByRole("button", { name: "Cancel invite to new@example.com" }));
  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith("cancel failed");
  });
});

test("co-parents see a read-only list without invite form", async () => {
  const listing: CoParentsListing = {
    coParents: [
      {
        _id: coParentId,
        email: "bob@example.com",
        name: null,
        userId: "bob",
        addedAt: Date.now(),
      },
    ],
    invites: [],
  };

  await using view = renderResource(
    <CoParentsSettingsView
      babyId={babyId}
      isOwner={false}
      listing={listing}
      onInvite={resolvedInvite()}
      onRemoveCoParent={resolvedVoid<{ coParentId: Id<"babyCoParents"> }>()}
      onCancelInvite={resolvedVoid<{ inviteId: Id<"babyCoParentInvites"> }>()}
    />,
  );

  expect(view.getByText("bob@example.com")).toBeTruthy();
  expect(view.queryByPlaceholderText("partner@example.com")).toBeNull();
  expect(view.queryByRole("button", { name: "Add" })).toBeNull();
  expect(view.queryByRole("button", { name: /^Remove / })).toBeNull();
});
