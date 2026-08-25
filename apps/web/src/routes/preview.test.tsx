import { fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import type {
  BabyUpdateHandler,
  MilestoneRedateHandler,
  MilestoneRemoveHandler,
} from "@workspace/convex/src/types";
import { LocaleProvider } from "@/lib/i18n";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { PreviewPageView, Route, type PreviewSearch } from "@/routes/preview";

const baseSearch: PreviewSearch = {
  name: "Nova",
  dueDate: "2026-09-01T00:00:00.000Z",
  laborStarted: "2026-08-10T08:00:00.000Z",
  wentToHospital: null,
  babyBorn: null,
  laborStartedMessage: "It has begun!",
  babyBornMessage: null,
  settings: true,
};

type SettingsStubProps = {
  onUpdate: BabyUpdateHandler;
  onMilestoneRedate: MilestoneRedateHandler;
  onMilestoneRemove: MilestoneRemoveHandler;
};

function SettingsStub(props: SettingsStubProps): ReactNode {
  return (
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
  );
}

test("preview routes settings and milestone edits to separate search updates", async () => {
  const navigate = vi.fn<(opts: unknown) => void>();

  await using view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <PreviewPageView
        search={baseSearch}
        navigate={navigate}
        renderSettingsPanel={(props) => <SettingsStub {...props} />}
      />
    </LocaleProvider>,
  );

  fireEvent.click(view.getByRole("button", { name: "update settings" }));
  fireEvent.click(view.getByRole("button", { name: "redate milestone" }));
  fireEvent.click(view.getByRole("button", { name: "remove milestone" }));

  expect(navigate).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      search: { ...baseSearch, name: "Nova Rae" },
      replace: true,
    }),
  );
  expect(navigate).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      search: {
        ...baseSearch,
        wentToHospital: "2026-08-10T12:00:00.000Z",
      },
      replace: true,
    }),
  );
  expect(navigate).toHaveBeenNthCalledWith(
    3,
    expect.objectContaining({
      search: { ...baseSearch, laborStarted: null },
      replace: true,
    }),
  );
});

test("preview derives a born status from its search dates", async () => {
  const search: PreviewSearch = {
    ...baseSearch,
    babyBorn: "2026-08-11T03:00:00.000Z",
    babyBornMessage: "She's here!",
    settings: false,
  };

  await using view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <PreviewPageView
        search={search}
        navigate={() => undefined}
        renderSettingsPanel={() => null}
      />
    </LocaleProvider>,
  );

  expect(view.getByRole("heading", { name: "Is Nova out yet?" })).toBeTruthy();
});

test("preview still supplies localized no-index metadata after the schema cutover", () => {
  const head = Route.options.head as unknown as (opts: {
    match: { context: { locale: "en-GB" } };
  }) => { meta: unknown[] };
  const result = head({
    match: { context: { locale: "en-GB" } },
  });
  expect(result.meta.length).toBeGreaterThan(2);
});
