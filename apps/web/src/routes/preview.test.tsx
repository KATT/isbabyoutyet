import { fireEvent, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type {
  BabyUpdateHandler,
  MilestoneRedateHandler,
  MilestoneRemoveHandler,
} from "@workspace/convex/src/types";
import { LocaleProvider } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {
    name: "Nova",
    dueDate: "2026-09-01T00:00:00.000Z",
    laborStarted: "2026-08-10T08:00:00.000Z",
    laborStartedMessage: "It has begun!",
    settings: true,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    ...options,
    fullPath: "/preview",
    useSearch: () => mocks.search,
  }),
  Link: (props: { children: ReactNode }) => <a href="/">{props.children}</a>,
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/components/baby/baby-nav", () => ({
  BabyNav: () => null,
}));

vi.mock("@/components/baby/progress-indicator", () => ({
  ProgressIndicator: () => null,
}));

vi.mock("@/components/baby/status-display", () => ({
  StatusDisplay: () => null,
}));

vi.mock("@/components/baby/settings-panel", () => ({
  SettingsPanel: (props: {
    onUpdate: BabyUpdateHandler;
    onMilestoneRedate: MilestoneRedateHandler;
    onMilestoneRemove: MilestoneRemoveHandler;
  }) => (
    <>
      <button type="button" onClick={() => props.onUpdate({ name: "Nova Rae" })}>
        update settings
      </button>
      <button
        type="button"
        onClick={() => props.onMilestoneRedate("gone_to_hospital", "2026-08-10T12:00:00.000Z")}
      >
        redate milestone
      </button>
      <button type="button" onClick={() => props.onMilestoneRemove("labor_started")}>
        remove milestone
      </button>
    </>
  ),
}));

const { PreviewPage } = await import("./preview");

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("preview routes settings and milestone edits to separate search updates", async () => {
  await using view = renderResource(
    <LocaleProvider locale="en-GB">
      <PreviewPage />
    </LocaleProvider>,
  );

  fireEvent.click(view.getByRole("button", { name: "update settings" }));
  fireEvent.click(view.getByRole("button", { name: "redate milestone" }));
  fireEvent.click(view.getByRole("button", { name: "remove milestone" }));

  expect(mocks.navigate).toHaveBeenNthCalledWith(1, {
    search: { ...mocks.search, name: "Nova Rae" },
    replace: true,
  });
  expect(mocks.navigate).toHaveBeenNthCalledWith(2, {
    search: {
      ...mocks.search,
      wentToHospital: "2026-08-10T12:00:00.000Z",
    },
    replace: true,
  });
  expect(mocks.navigate).toHaveBeenNthCalledWith(3, {
    search: { ...mocks.search, laborStarted: null },
    replace: true,
  });
});
