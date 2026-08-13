import { fireEvent, render, waitFor } from "@testing-library/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import {
  CoParentsSettings,
  CoParentsSettingsView,
  type CoParentsListing,
} from "@/components/baby/co-parents-settings";

function renderResource(ui: React.ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("CoParentsSettings wires useQuery/useMutation into the view", async () => {
  const client = new ConvexReactClient("http://127.0.0.1:3210");
  await using view = renderResource(
    <ConvexProvider client={client}>
      <CoParentsSettings babyId={"fake-baby-id" as Id<"baby">} isOwner={true} />
    </ConvexProvider>,
  );
  expect(view.getByText(/Loading co-parents/i)).toBeTruthy();
  await client.close();
});

test("owner can invite a co-parent by email", async () => {
  const onInvite = vi.fn<(email: string) => Promise<{ status: "added" | "invited" }>>();
  onInvite.mockResolvedValue({ status: "added" });
  const listing: CoParentsListing = { coParents: [], invites: [] };

  await using view = renderResource(
    <CoParentsSettingsView
      isOwner={true}
      listing={listing}
      onInvite={onInvite}
      onRemoveCoParent={vi.fn<(coParentId: Id<"babyCoParents">) => Promise<unknown>>()}
      onCancelInvite={vi.fn<(inviteId: Id<"babyCoParentInvites">) => Promise<unknown>>()}
    />,
  );

  expect(view.getByText(/No co-parents yet/)).toBeTruthy();
  fireEvent.change(view.getByPlaceholderText("partner@example.com"), {
    target: { value: "partner@example.com" },
  });
  fireEvent.click(view.getByRole("button", { name: "Add" }));

  await waitFor(() => {
    expect(onInvite).toHaveBeenCalledWith("partner@example.com");
  });
});

test("lists co-parents and pending invites; owner can remove them", async () => {
  const onRemoveCoParent = vi.fn<(coParentId: Id<"babyCoParents">) => Promise<unknown>>();
  const onCancelInvite = vi.fn<(inviteId: Id<"babyCoParentInvites">) => Promise<unknown>>();
  onRemoveCoParent.mockResolvedValue(null);
  onCancelInvite.mockResolvedValue(null);

  const listing: CoParentsListing = {
    coParents: [
      {
        _id: "jd7coparent00000000000000" as Id<"babyCoParents">,
        email: "bob@example.com",
        name: "Bob",
        userId: "bob",
        addedAt: Date.now(),
      },
    ],
    invites: [
      {
        _id: "jd7invite0000000000000000" as Id<"babyCoParentInvites">,
        email: "new@example.com",
        createdAt: Date.now(),
      },
    ],
  };

  await using view = renderResource(
    <CoParentsSettingsView
      isOwner={true}
      listing={listing}
      onInvite={vi.fn<(email: string) => Promise<{ status: "added" | "invited" }>>()}
      onRemoveCoParent={onRemoveCoParent}
      onCancelInvite={onCancelInvite}
    />,
  );

  expect(view.getByText("Bob")).toBeTruthy();
  expect(view.getByText("Invite pending")).toBeTruthy();

  fireEvent.click(view.getByRole("button", { name: "Remove bob@example.com" }));
  await waitFor(() => {
    expect(onRemoveCoParent).toHaveBeenCalled();
  });

  fireEvent.click(view.getByRole("button", { name: "Cancel invite to new@example.com" }));
  await waitFor(() => {
    expect(onCancelInvite).toHaveBeenCalled();
  });
});

test("co-parents see a read-only list without invite form", async () => {
  const listing: CoParentsListing = {
    coParents: [
      {
        _id: "jd7coparent00000000000000" as Id<"babyCoParents">,
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
      isOwner={false}
      listing={listing}
      onInvite={vi.fn<(email: string) => Promise<{ status: "added" | "invited" }>>()}
      onRemoveCoParent={vi.fn<(coParentId: Id<"babyCoParents">) => Promise<unknown>>()}
      onCancelInvite={vi.fn<(inviteId: Id<"babyCoParentInvites">) => Promise<unknown>>()}
    />,
  );

  expect(view.getByText("bob@example.com")).toBeTruthy();
  expect(view.queryByPlaceholderText("partner@example.com")).toBeNull();
  expect(view.queryByRole("button", { name: "Add" })).toBeNull();
});
