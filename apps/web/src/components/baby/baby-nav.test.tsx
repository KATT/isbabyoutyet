import { expect, test } from "vitest";
import { BabyNav } from "@/components/baby/baby-nav";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";

test("groups owner actions separately from page actions", async () => {
  await using view = await renderWithTestRouter(
    <BabyNav
      shareLink="https://example.com/baby/demo"
      onPostUpdate={() => {}}
      onShareCopied={null}
      onSettingsOpened={null}
      settingsButton={{ to: "/" }}
      settingsOpen={false}
    />,
  );

  const ownerGroup = view.getByRole("group", { name: "Owner actions" });
  const pageGroup = view.getByRole("group", { name: "Page actions" });
  const postUpdate = view.getByRole("button", { name: /post update/i });
  const settings = view.getByRole("button", { name: /settings/i });
  const share = view.getByRole("button", { name: /copy link to share/i });
  const theme = view.getByRole("button", { name: /toggle theme/i });

  expect(ownerGroup.contains(postUpdate)).toBe(true);
  expect(ownerGroup.contains(settings)).toBe(true);
  expect(pageGroup.contains(share)).toBe(true);
  expect(pageGroup.contains(theme)).toBe(true);
});

test("hides the owner group when the visitor has no owner actions", async () => {
  await using view = await renderWithTestRouter(
    <BabyNav
      shareLink="https://example.com/baby/demo"
      onPostUpdate={null}
      onShareCopied={null}
      onSettingsOpened={null}
      settingsButton={null}
      settingsOpen={false}
    />,
  );

  expect(view.queryByRole("group", { name: "Owner actions" })).toBeNull();
  expect(view.getByRole("group", { name: "Page actions" })).toBeTruthy();
});

test("disables sharing when the share link is empty", async () => {
  await using view = await renderWithTestRouter(
    <BabyNav
      shareLink=""
      onPostUpdate={null}
      onShareCopied={null}
      onSettingsOpened={null}
      settingsButton={{ to: "/" }}
      settingsOpen={true}
    />,
  );

  const share = view.getByRole("button", { name: /copy link to share/i }) as HTMLButtonElement;
  expect(share.disabled).toBe(true);
  expect(view.getByRole("button", { name: /close settings/i })).toBeTruthy();
});
