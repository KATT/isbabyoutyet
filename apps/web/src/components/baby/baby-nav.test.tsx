import { fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { BabyNav } from "@/components/baby/baby-nav";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { htmlButton, htmlElement } from "@/test/htmlElement";

test("groups owner actions separately from page actions", async () => {
  await using view = await renderWithTestRouter(
    <BabyNav
      shareButton={{ to: "/baby/$publicId/share" }}
      shareOpen={false}
      onDismissShare={null}
      postUpdateButton={{ to: "/baby/$publicId/post" }}
      postUpdateOpen={false}
      onDismissPostUpdate={null}
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

test("collapses Post update to an icon on small screens without dropping the name", async () => {
  await using view = await renderWithTestRouter(
    <BabyNav
      shareButton={{ to: "/baby/$publicId/share" }}
      shareOpen={false}
      onDismissShare={null}
      postUpdateButton={{ to: "/baby/$publicId/post" }}
      postUpdateOpen={false}
      onDismissPostUpdate={null}
      onSettingsOpened={null}
      settingsButton={{ to: "/" }}
      settingsOpen={false}
      onDismissSettings={null}
    />,
  );

  expect(htmlElement(view.getByRole("button", { name: "Post update" })).className).toMatch(
    /max-sm:size-8/,
  );
  const label = [...view.container.querySelectorAll("span")].find(
    (el) => el.textContent === "Post update",
  );
  expect(htmlElement(label ?? null).className).toMatch(/max-sm:sr-only/);
});

test("hides the owner group when the visitor has no owner actions", async () => {
  await using view = await renderWithTestRouter(
    <BabyNav
      shareButton={{ to: "/baby/$publicId/share" }}
      shareOpen={false}
      onDismissShare={null}
      postUpdateButton={null}
      postUpdateOpen={false}
      onDismissPostUpdate={null}
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
  await using view = await renderWithTestRouter(
    <BabyNav
      shareButton={null}
      shareOpen={false}
      onDismissShare={null}
      postUpdateButton={null}
      postUpdateOpen={false}
      onDismissPostUpdate={null}
      onSettingsOpened={null}
      settingsButton={{ to: "/" }}
      settingsOpen={true}
      onDismissSettings={() => {}}
    />,
  );

  const share = htmlButton(view.getByRole("button", { name: /share the link/i }));
  expect(share.disabled).toBe(true);
  expect(view.getByRole("button", { name: /close settings/i })).toBeTruthy();
});

test("calls dismiss handlers when overlay owner actions are open", async () => {
  const onDismissShare = vi.fn<() => void>();
  const onDismissPostUpdate = vi.fn<() => void>();
  const onDismissSettings = vi.fn<() => void>();

  await using view = await renderWithTestRouter(
    <BabyNav
      shareButton={{ to: "/baby/$publicId/share" }}
      shareOpen={true}
      onDismissShare={onDismissShare}
      postUpdateButton={{ to: "/baby/$publicId/post" }}
      postUpdateOpen={true}
      onDismissPostUpdate={onDismissPostUpdate}
      onSettingsOpened={null}
      settingsButton={{ to: "/baby/$publicId/settings" }}
      settingsOpen={true}
      onDismissSettings={onDismissSettings}
    />,
  );

  fireEvent.click(view.getByRole("button", { name: /close share preview/i }));
  fireEvent.click(view.getByRole("button", { name: /post update/i }));
  fireEvent.click(view.getByRole("button", { name: /close settings/i }));

  expect(onDismissShare).toHaveBeenCalledOnce();
  expect(onDismissPostUpdate).toHaveBeenCalledOnce();
  expect(onDismissSettings).toHaveBeenCalledOnce();
});
