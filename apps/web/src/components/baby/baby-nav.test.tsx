import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render } from "@testing-library/react";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { BabyNav } from "./baby-nav";
import { renderResource } from "./test-helpers";
import { makeResource } from "@workspace/convex/convex/test.resource";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function useClipboard(writeText: (text: string) => Promise<void>) {
  vi.clearAllMocks();
  const writeTextMock = vi.fn(writeText);
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: writeTextMock },
    configurable: true,
  });
  return makeResource({ writeTextMock }, () => {
    delete (window.navigator as { clipboard?: unknown }).clipboard;
  });
}

test("copies the share link to the clipboard", async () => {
  await using clipboard = useClipboard(async () => {});
  await using view = renderResource(
    render(
      <BabyNav shareLink="https://example.com/baby/x" settingsButton={null} settingsOpen={false} />,
    ),
  );

  const [shareButton] = view.getAllByRole("button");
  fireEvent.click(shareButton);

  await vi.waitFor(() => {
    expect(clipboard.writeTextMock).toHaveBeenCalledWith("https://example.com/baby/x");
  });
  expect(toast.success).toHaveBeenCalledWith("Copied to clipboard");
});

test("falls back to execCommand when the clipboard API fails", async () => {
  await using _clipboard = useClipboard(async () => {
    throw new Error("denied");
  });
  const execCommandMock = vi.fn(() => true);
  document.execCommand = execCommandMock as never;

  await using view = renderResource(
    render(
      <BabyNav shareLink="https://example.com/baby/x" settingsButton={null} settingsOpen={false} />,
    ),
  );

  const [shareButton] = view.getAllByRole("button");
  fireEvent.click(shareButton);

  await vi.waitFor(() => {
    expect(execCommandMock).toHaveBeenCalledWith("copy");
  });
  expect(toast.success).toHaveBeenCalledWith("Copied to clipboard");
});

test("reports an error when every copy mechanism fails", async () => {
  await using _clipboard = useClipboard(async () => {
    throw new Error("denied");
  });
  document.execCommand = vi.fn(() => {
    throw new Error("also denied");
  }) as never;

  await using view = renderResource(
    render(
      <BabyNav shareLink="https://example.com/baby/x" settingsButton={null} settingsOpen={false} />,
    ),
  );

  const [shareButton] = view.getAllByRole("button");
  fireEvent.click(shareButton);

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to copy to clipboard"),
    );
  });
});

test("reports a generic error when the failure is not an Error", async () => {
  await using _clipboard = useClipboard(async () => {
    throw new Error("denied");
  });
  document.execCommand = vi.fn(() => {
    // eslint-disable-next-line no-throw-literal
    throw "nope";
  }) as never;

  await using view = renderResource(
    render(
      <BabyNav shareLink="https://example.com/baby/x" settingsButton={null} settingsOpen={false} />,
    ),
  );

  const [shareButton] = view.getAllByRole("button");
  fireEvent.click(shareButton);

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Failed to copy to clipboard: Unknown error");
  });
});

test("the share button is disabled without a share link", async () => {
  await using clipboard = useClipboard(async () => {});
  await using view = renderResource(
    render(<BabyNav shareLink={null} settingsButton={null} settingsOpen={false} />),
  );

  const [shareButton] = view.getAllByRole("button");
  expect(shareButton.hasAttribute("disabled")).toBe(true);
  fireEvent.click(shareButton);
  expect(clipboard.writeTextMock).not.toHaveBeenCalled();
});

test.each([true, false])(
  "renders a settings link when settingsButton is provided (settingsOpen: %s)",
  async (settingsOpen) => {
    await using _clipboard = useClipboard(async () => {});

    const rootRoute = createRootRoute({
      component: () => (
        <BabyNav
          shareLink="https://example.com/baby/x"
          settingsButton={{ to: "/", search: { settings: true } }}
          settingsOpen={settingsOpen}
        />
      ),
    });
    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });

    await using _view = renderResource(render(<RouterProvider router={router as never} />));

    // The settings link renders as an anchor (with Base UI's button role)
    await vi.waitFor(() => {
      const anchor = document.body.querySelector("a[href]");
      expect(anchor?.getAttribute("href")).toContain("settings=true");
    });
  },
);
