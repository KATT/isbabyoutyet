import { fireEvent, render, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { CoParentsSettings } from "@/components/baby/co-parents-settings";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  invite: vi.fn(),
  removeCoParent: vi.fn(),
  cancelInvite: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
  // CoParentsSettings calls useMutation in fixed order: invite, remove, cancel
  useMutation: (() => {
    let call = 0;
    return () => {
      const index = call;
      call += 1;
      if (index % 3 === 0) return mocks.invite;
      if (index % 3 === 1) return mocks.removeCoParent;
      return mocks.cancelInvite;
    };
  })(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderResource(ui: React.ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

const babyId = "jd7baby000000000000000000" as Id<"baby">;

test("owner can invite a co-parent by email", async () => {
  mocks.useQuery.mockReturnValue({
    coParents: [],
    invites: [],
  });
  mocks.invite.mockResolvedValue({ status: "added" });

  await using view = renderResource(<CoParentsSettings babyId={babyId} isOwner={true} />);

  expect(view.getByText(/No co-parents yet/)).toBeTruthy();
  fireEvent.change(view.getByPlaceholderText("partner@example.com"), {
    target: { value: "partner@example.com" },
  });
  fireEvent.click(view.getByRole("button", { name: "Add" }));

  await waitFor(() => {
    expect(mocks.invite).toHaveBeenCalledWith({
      babyId,
      email: "partner@example.com",
    });
  });
});

test("lists co-parents and pending invites; owner can remove them", async () => {
  mocks.useQuery.mockReturnValue({
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
  });
  mocks.removeCoParent.mockResolvedValue(null);
  mocks.cancelInvite.mockResolvedValue(null);

  await using view = renderResource(<CoParentsSettings babyId={babyId} isOwner={true} />);

  expect(view.getByText("Bob")).toBeTruthy();
  expect(view.getByText("Invite pending")).toBeTruthy();

  fireEvent.click(view.getByRole("button", { name: "Remove bob@example.com" }));
  await waitFor(() => {
    expect(mocks.removeCoParent).toHaveBeenCalled();
  });

  fireEvent.click(view.getByRole("button", { name: "Cancel invite to new@example.com" }));
  await waitFor(() => {
    expect(mocks.cancelInvite).toHaveBeenCalled();
  });
});

test("co-parents see a read-only list without invite form", async () => {
  mocks.useQuery.mockReturnValue({
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
  });

  await using view = renderResource(<CoParentsSettings babyId={babyId} isOwner={false} />);

  expect(view.getByText("bob@example.com")).toBeTruthy();
  expect(view.queryByPlaceholderText("partner@example.com")).toBeNull();
  expect(view.queryByRole("button", { name: "Add" })).toBeNull();
});
