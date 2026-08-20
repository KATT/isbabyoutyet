import { fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";

vi.mock("@tanstack/react-router", () => ({
  Link: (props: React.ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"} {...props} />
  ),
}));

vi.mock("@workspace/ui/components/mode-toggle", () => ({
  ModeToggle: () => <button type="button">Toggle theme</button>,
}));

const { BabyNav } = await import("@/components/baby/baby-nav");

const sharePreview = {
  imageUrl: "https://example.com/og/baby/demo",
  title: "Is Demo Baby out yet?",
  description: "Track Demo Baby's journey.",
};

function renderResource(ui: React.ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("groups owner actions separately from page actions", async () => {
  await using view = renderResource(
    <BabyNav
      shareLink="https://example.com/baby/demo"
      sharePreview={sharePreview}
      postUpdateButton={{ to: "/baby/$publicId/post" }}
      postUpdateOpen={false}
      onDismissPostUpdate={null}
      onShareCopied={null}
      onSettingsOpened={null}
      settingsButton={{ to: "/" }}
      settingsOpen={false}
      onDismissSettings={null}
    />,
  );

  const ownerGroup = view.getByRole("group", { name: "Owner actions" });
  const pageGroup = view.getByRole("group", { name: "Page actions" });
  const postUpdate = view.getByRole("button", { name: /post update/i });
  const settings = view.getByRole("button", { name: /settings/i });
  const share = view.getByRole("button", { name: /share the link/i });
  const theme = view.getByRole("button", { name: /toggle theme/i });

  expect(ownerGroup.contains(postUpdate)).toBe(true);
  expect(ownerGroup.contains(settings)).toBe(true);
  expect(pageGroup.contains(share)).toBe(true);
  expect(pageGroup.contains(theme)).toBe(true);
});

test("opens the share preview before copying the link", async () => {
  await using view = renderResource(
    <BabyNav
      shareLink="https://example.com/baby/demo"
      sharePreview={sharePreview}
      postUpdateButton={null}
      postUpdateOpen={false}
      onDismissPostUpdate={null}
      onShareCopied={null}
      onSettingsOpened={null}
      settingsButton={null}
      settingsOpen={false}
      onDismissSettings={null}
    />,
  );

  fireEvent.click(view.getByRole("button", { name: "Share the link" }));

  expect(view.getByRole("dialog")).toBeTruthy();
  expect(view.getByRole("heading", { name: "Share the Link" })).toBeTruthy();
  expect(view.getByText("This is how your page will look when shared.")).toBeTruthy();
  expect(view.getByRole("img", { name: sharePreview.title }).getAttribute("src")).toBe(
    sharePreview.imageUrl,
  );
  expect(view.getByText(sharePreview.title)).toBeTruthy();
  expect(view.getByText(sharePreview.description)).toBeTruthy();
  expect(view.getByText("https://example.com/baby/demo")).toBeTruthy();
});

test("copies the share link from the preview", async () => {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  const onShareCopied = vi.fn<() => void>();
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  await using _clipboard = makeResource({}, () => {
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  await using view = renderResource(
    <BabyNav
      shareLink="https://example.com/baby/demo"
      sharePreview={sharePreview}
      postUpdateButton={null}
      postUpdateOpen={false}
      onDismissPostUpdate={null}
      onShareCopied={onShareCopied}
      onSettingsOpened={null}
      settingsButton={null}
      settingsOpen={false}
      onDismissSettings={null}
    />,
  );

  fireEvent.click(view.getByRole("button", { name: "Share the link" }));
  fireEvent.click(view.getByRole("button", { name: "Copy link to share" }));

  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledWith("https://example.com/baby/demo");
    expect(onShareCopied).toHaveBeenCalledOnce();
    expect(view.getByRole("button", { name: "Copied!" })).toBeTruthy();
  });
});

test("hides the owner group when the visitor has no owner actions", async () => {
  await using view = renderResource(
    <BabyNav
      shareLink="https://example.com/baby/demo"
      sharePreview={sharePreview}
      postUpdateButton={null}
      postUpdateOpen={false}
      onDismissPostUpdate={null}
      onShareCopied={null}
      onSettingsOpened={null}
      settingsButton={null}
      settingsOpen={false}
      onDismissSettings={null}
    />,
  );

  expect(view.queryByRole("group", { name: "Owner actions" })).toBeNull();
  expect(view.getByRole("group", { name: "Page actions" })).toBeTruthy();
});

test("disables sharing when the share link is empty", async () => {
  await using view = renderResource(
    <BabyNav
      shareLink=""
      sharePreview={null}
      postUpdateButton={null}
      postUpdateOpen={false}
      onDismissPostUpdate={null}
      onShareCopied={null}
      onSettingsOpened={null}
      settingsButton={{ to: "/" }}
      settingsOpen={true}
      onDismissSettings={() => {}}
    />,
  );

  const share = view.getByRole("button", { name: /share the link/i }) as HTMLButtonElement;
  expect(share.disabled).toBe(true);
  expect(view.getByRole("button", { name: /close settings/i })).toBeTruthy();
});

test("calls dismiss handlers when overlay owner actions are open", async () => {
  const onDismissPostUpdate = vi.fn<() => void>();
  const onDismissSettings = vi.fn<() => void>();

  await using view = renderResource(
    <BabyNav
      shareLink="https://example.com/baby/demo"
      sharePreview={sharePreview}
      postUpdateButton={{ to: "/baby/$publicId/post" }}
      postUpdateOpen={true}
      onDismissPostUpdate={onDismissPostUpdate}
      onShareCopied={null}
      onSettingsOpened={null}
      settingsButton={{ to: "/baby/$publicId/settings" }}
      settingsOpen={true}
      onDismissSettings={onDismissSettings}
    />,
  );

  fireEvent.click(view.getByRole("button", { name: /post update/i }));
  fireEvent.click(view.getByRole("button", { name: /close settings/i }));

  expect(onDismissPostUpdate).toHaveBeenCalledOnce();
  expect(onDismissSettings).toHaveBeenCalledOnce();
});
