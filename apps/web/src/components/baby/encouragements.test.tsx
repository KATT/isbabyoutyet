import { fireEvent, render, screen } from "@testing-library/react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { EncouragementForm, EncouragementsFeed } from "./encouragements";
import { renderResource } from "./test-helpers";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { makeResource } from "@workspace/convex/convex/test.resource";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    promise: vi.fn((promise: Promise<unknown>, opts?: { error?: (error: unknown) => string }) => {
      // Exercise the error-message callback like real sonner would
      promise.catch((error) => opts?.error?.(error));
    }),
  },
}));

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));

const BABY_ID = "baby-1" as Id<"baby">;

type IntersectionCallback = (entries: { isIntersecting: boolean }[]) => void;

function useIntersectionObserverStub() {
  const callbacks: IntersectionCallback[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionCallback) {
        callbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  return makeResource({ callbacks }, () => {
    vi.unstubAllGlobals();
  });
}

function useLocalStorageResource() {
  localStorage.clear();
  return makeResource({}, () => {
    localStorage.clear();
  });
}

function makeEncouragement(overrides: {
  _id: string;
  authorName?: string;
  message?: string;
  createdAt?: number;
  visitorId?: string;
}) {
  return {
    _id: overrides._id as Id<"encouragements">,
    _creationTime: 0,
    babyId: BABY_ID,
    authorName: overrides.authorName ?? "Grandma",
    message: overrides.message ?? "Good luck!",
    createdAt: overrides.createdAt ?? Date.now(),
    visitorId: overrides.visitorId,
  };
}

test("EncouragementForm submits a trimmed message and remembers the author name", async () => {
  await using _storage = useLocalStorageResource();
  const createMock = vi.fn(async () => "enc-1");
  vi.mocked(useMutation).mockReturnValue(createMock as never);

  await using view = renderResource(
    render(<EncouragementForm babyId={BABY_ID} babyName="Baby Smith" />),
  );

  expect(view.getByText(/Leave a message of support for Baby Smith/)).toBeTruthy();

  fireEvent.change(view.getByPlaceholderText("Your name"), { target: { value: "  Grandma  " } });
  fireEvent.change(view.getByPlaceholderText("Write your message of encouragement..."), {
    target: { value: "You got this!" },
  });
  fireEvent.click(view.getByRole("button", { name: /Send Encouragement/ }));

  await vi.waitFor(() => {
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        babyId: BABY_ID,
        authorName: "Grandma",
        message: "You got this!",
        visitorId: expect.any(String),
      }),
    );
  });
  expect(localStorage.getItem("encouragement-author-name")).toBe("Grandma");
  expect(toast.promise).toHaveBeenCalled();
});

test("EncouragementForm shows validation errors and preloads the saved name", async () => {
  await using _storage = useLocalStorageResource();
  localStorage.setItem("encouragement-author-name", "Saved Name");
  const createMock = vi.fn(async () => "enc-1");
  vi.mocked(useMutation).mockReturnValue(createMock as never);

  await using view = renderResource(
    render(<EncouragementForm babyId={BABY_ID} babyName="Baby Smith" />),
  );

  // Saved name is loaded from localStorage
  await vi.waitFor(() => {
    expect(view.getByDisplayValue("Saved Name")).toBeTruthy();
  });

  // Submitting without a message shows the zod error
  fireEvent.click(view.getByRole("button", { name: /Send Encouragement/ }));
  await vi.waitFor(() => {
    expect(view.getByText("Message is required")).toBeTruthy();
  });
  expect(createMock).not.toHaveBeenCalled();
});

test("EncouragementForm surfaces submit failures via the form's error handler", async () => {
  await using _storage = useLocalStorageResource();
  const createMock = vi.fn(async () => {
    throw new Error("Server says no");
  });
  vi.mocked(useMutation).mockReturnValue(createMock as never);

  await using view = renderResource(
    render(<EncouragementForm babyId={BABY_ID} babyName="Baby Smith" />),
  );

  fireEvent.change(view.getByPlaceholderText("Your name"), { target: { value: "Grandma" } });
  fireEvent.change(view.getByPlaceholderText("Write your message of encouragement..."), {
    target: { value: "Hi" },
  });
  fireEvent.click(view.getByRole("button", { name: /Send Encouragement/ }));

  await vi.waitFor(
    () => {
      expect(toast.error).toHaveBeenCalledWith("Server says no");
    },
    { timeout: 3000 },
  );
});

test("EncouragementForm shows a generic error for non-Error failures", async () => {
  await using _storage = useLocalStorageResource();
  const createMock = vi.fn(async () => {
    // eslint-disable-next-line no-throw-literal
    throw "boom";
  });
  vi.mocked(useMutation).mockReturnValue(createMock as never);

  await using view = renderResource(
    render(<EncouragementForm babyId={BABY_ID} babyName="Baby Smith" />),
  );

  fireEvent.change(view.getByPlaceholderText("Your name"), { target: { value: "Grandma" } });
  fireEvent.change(view.getByPlaceholderText("Write your message of encouragement..."), {
    target: { value: "Hi" },
  });
  fireEvent.click(view.getByRole("button", { name: /Send Encouragement/ }));

  await vi.waitFor(
    () => {
      expect(toast.error).toHaveBeenCalledWith("Failed to submit form");
    },
    { timeout: 3000 },
  );
});

test("EncouragementsFeed renders anonymous and future-dated posts", async () => {
  await using _io = useIntersectionObserverStub();
  await using _storage = useLocalStorageResource();

  vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [
      {
        ...makeEncouragement({ _id: "enc-anon", message: "Posted anonymously" }),
        visitorId: undefined,
        // Buffer a minute so flooring can't round down to "in 1 hour"
        createdAt: Date.now() + 2 * 60 * 60 * 1000 + 60 * 1000,
      },
    ],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  } as never);

  await using view = renderResource(
    render(<EncouragementsFeed babyId={BABY_ID} isOwner={false} />),
  );

  expect(view.getByText("Posted anonymously")).toBeTruthy();
  expect(view.getByText(/in 2 hours/)).toBeTruthy();
  expect(view.queryByText("(you)")).toBeNull();
});

test("EncouragementsFeed shows loading and empty states", async () => {
  await using _io = useIntersectionObserverStub();
  await using _storage = useLocalStorageResource();
  vi.mocked(useMutation).mockReturnValue(vi.fn() as never);

  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [],
    status: "LoadingFirstPage",
    loadMore: vi.fn(),
    isLoading: true,
  } as never);
  await using loadingView = renderResource(
    render(<EncouragementsFeed babyId={BABY_ID} isOwner={false} />),
  );
  expect(loadingView.getByText("Loading encouragements...")).toBeTruthy();

  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  } as never);
  await using emptyView = renderResource(
    render(<EncouragementsFeed babyId={BABY_ID} isOwner={false} />),
  );
  expect(emptyView.getByText("No encouragements yet")).toBeTruthy();
});

test("EncouragementsFeed renders posts and lets the author edit within the window", async () => {
  await using _io = useIntersectionObserverStub();
  await using _storage = useLocalStorageResource();
  localStorage.setItem("encouragement-visitor-id", "visitor-me");

  const updateMock = vi.fn(async () => {});
  vi.mocked(useMutation).mockReturnValue(updateMock as never);
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [
      makeEncouragement({ _id: "enc-own", visitorId: "visitor-me", message: "My own post" }),
      makeEncouragement({
        _id: "enc-other",
        authorName: "Someone",
        visitorId: "visitor-other",
        message: "Another post",
      }),
    ],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  } as never);

  await using view = renderResource(
    render(<EncouragementsFeed babyId={BABY_ID} isOwner={false} />),
  );

  expect(view.getByText("My own post")).toBeTruthy();
  expect(view.getByText("Another post")).toBeTruthy();
  await vi.waitFor(() => {
    expect(view.getByText("(you)")).toBeTruthy();
  });

  // Edit own post
  const pencil = view.container.querySelector("svg.lucide-pencil")?.closest("button");
  if (!pencil) throw new Error("edit button not found");
  fireEvent.click(pencil);

  const textarea = view.getByDisplayValue("My own post");
  fireEvent.change(textarea, { target: { value: "Edited post" } });
  fireEvent.click(view.getByRole("button", { name: /Save/ }));

  await vi.waitFor(() => {
    expect(updateMock).toHaveBeenCalledWith({
      encouragementId: "enc-own",
      visitorId: "visitor-me",
      message: "Edited post",
    });
  });
  expect(toast.success).toHaveBeenCalledWith("Encouragement updated");
});

test("EncouragementsFeed rejects saving an empty edit", async () => {
  await using _io = useIntersectionObserverStub();
  await using _storage = useLocalStorageResource();
  localStorage.setItem("encouragement-visitor-id", "visitor-me");

  vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [makeEncouragement({ _id: "enc-own", visitorId: "visitor-me" })],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  } as never);

  await using view = renderResource(
    render(<EncouragementsFeed babyId={BABY_ID} isOwner={false} />),
  );
  await vi.waitFor(() => {
    expect(view.getByText("(you)")).toBeTruthy();
  });

  const pencil = view.container.querySelector("svg.lucide-pencil")?.closest("button");
  if (!pencil) throw new Error("edit button not found");
  fireEvent.click(pencil);

  fireEvent.change(view.getByDisplayValue("Good luck!"), { target: { value: "   " } });
  fireEvent.click(view.getByRole("button", { name: /Save/ }));

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Message cannot be empty");
  });

  // Cancel editing restores the original message
  fireEvent.click(view.getByRole("button", { name: /Cancel/ }));
  expect(view.getByText("Good luck!")).toBeTruthy();
});

test("the baby owner can delete any post via the confirmation dialog", async () => {
  await using _io = useIntersectionObserverStub();
  await using _storage = useLocalStorageResource();

  const removeMock = vi.fn(async () => {});
  vi.mocked(useMutation).mockReturnValue(removeMock as never);
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [
      makeEncouragement({
        _id: "enc-1",
        authorName: "Someone",
        visitorId: "visitor-other",
        // Outside the edit window: only deletable because we are the owner
        createdAt: Date.now() - 60 * 60 * 1000,
      }),
    ],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  } as never);

  await using view = renderResource(render(<EncouragementsFeed babyId={BABY_ID} isOwner />));

  const trash = view.container.querySelector("svg.lucide-trash-2")?.closest("button");
  if (!trash) throw new Error("delete button not found");
  fireEvent.click(trash);

  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

  await vi.waitFor(() => {
    expect(removeMock).toHaveBeenCalledWith({ encouragementId: "enc-1", visitorId: undefined });
  });
  expect(toast.success).toHaveBeenCalledWith("Encouragement removed");
});

test("a visitor deleting their own post passes their visitor id", async () => {
  await using _io = useIntersectionObserverStub();
  await using _storage = useLocalStorageResource();
  localStorage.setItem("encouragement-visitor-id", "visitor-me");

  const removeMock = vi.fn(async () => {});
  vi.mocked(useMutation).mockReturnValue(removeMock as never);
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [makeEncouragement({ _id: "enc-own", visitorId: "visitor-me" })],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  } as never);

  await using view = renderResource(
    render(<EncouragementsFeed babyId={BABY_ID} isOwner={false} />),
  );
  await vi.waitFor(() => {
    expect(view.getByText("(you)")).toBeTruthy();
  });

  const trash = view.container.querySelector("svg.lucide-trash-2")?.closest("button");
  if (!trash) throw new Error("delete button not found");
  fireEvent.click(trash);
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

  await vi.waitFor(() => {
    expect(removeMock).toHaveBeenCalledWith({
      encouragementId: "enc-own",
      visitorId: "visitor-me",
    });
  });
});

test("non-Error delete failures get a generic message", async () => {
  await using _io = useIntersectionObserverStub();
  await using _storage = useLocalStorageResource();

  const removeMock = vi.fn(async () => {
    // eslint-disable-next-line no-throw-literal
    throw "boom";
  });
  vi.mocked(useMutation).mockReturnValue(removeMock as never);
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [
      makeEncouragement({ _id: "enc-1", authorName: "Someone", visitorId: "visitor-other" }),
    ],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  } as never);

  await using view = renderResource(render(<EncouragementsFeed babyId={BABY_ID} isOwner />));

  const trash = view.container.querySelector("svg.lucide-trash-2")?.closest("button");
  if (!trash) throw new Error("delete button not found");
  fireEvent.click(trash);
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Failed to remove encouragement");
  });
});

test("delete failures surface as a toast", async () => {
  await using _io = useIntersectionObserverStub();
  await using _storage = useLocalStorageResource();

  const removeMock = vi.fn(async () => {
    throw new Error("Delete rejected");
  });
  vi.mocked(useMutation).mockReturnValue(removeMock as never);
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [
      makeEncouragement({ _id: "enc-1", authorName: "Someone", visitorId: "visitor-other" }),
    ],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  } as never);

  await using view = renderResource(render(<EncouragementsFeed babyId={BABY_ID} isOwner />));

  const trash = view.container.querySelector("svg.lucide-trash-2")?.closest("button");
  if (!trash) throw new Error("delete button not found");
  fireEvent.click(trash);
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Delete rejected");
  });
});

test("infinite scroll loads more when the sentinel becomes visible", async () => {
  await using io = useIntersectionObserverStub();
  await using _storage = useLocalStorageResource();

  const loadMore = vi.fn();
  vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [makeEncouragement({ _id: "enc-1" })],
    status: "CanLoadMore",
    loadMore,
    isLoading: false,
  } as never);

  await using _view = renderResource(
    render(<EncouragementsFeed babyId={BABY_ID} isOwner={false} />),
  );

  expect(io.callbacks.length).toBeGreaterThan(0);
  io.callbacks[0]([{ isIntersecting: true }]);
  expect(loadMore).toHaveBeenCalledWith(20);

  // Non-intersecting entries do not trigger loading
  io.callbacks[0]([{ isIntersecting: false }]);
  expect(loadMore).toHaveBeenCalledTimes(1);
});

test("shows the loading indicator while fetching more posts", async () => {
  await using _io = useIntersectionObserverStub();
  await using _storage = useLocalStorageResource();

  vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [makeEncouragement({ _id: "enc-1" })],
    status: "LoadingMore",
    loadMore: vi.fn(),
    isLoading: true,
  } as never);

  await using view = renderResource(
    render(<EncouragementsFeed babyId={BABY_ID} isOwner={false} />),
  );
  // The LoadingMore state renders a spinner inside the sentinel
  expect(view.container.querySelector(".py-2 .text-center")).toBeTruthy();
});
