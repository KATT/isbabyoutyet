import { fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import { AddBabyPageView, Route } from "./dashboard_.add";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";

function renderAddBaby(opts: {
  createBaby: (args: unknown) => Promise<{ publicId: string }>;
  navigate: (args: unknown) => Promise<void>;
}) {
  return renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <AddBabyPageView
        createBaby={opts.createBaby as never}
        navigate={opts.navigate as never}
      />
    </LocaleProvider>,
    { path: "/dashboard/add" },
  );
}

test("add baby remains a standalone non-nested dashboard route", () => {
  expect(Route.id).toBe("/_auth/dashboard_/add");
  expect(Route.options.component).toBeTypeOf("function");
});

test("journey choices explain visible statuses and privacy", async () => {
  const createBaby = vi.fn<(args: unknown) => Promise<{ publicId: string }>>();
  const navigate = vi.fn<(args: unknown) => Promise<void>>();
  await using view = await renderAddBaby({ createBaby, navigate });

  expect(view.getByRole("radio", { name: "Labour" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Home birth" })).toBeTruthy();
  expect(view.getByRole("radio", { name: "Planned C-section" })).toBeTruthy();
  expect(view.getByRole("radiogroup", { name: "Choose a journey" }).className).not.toContain(
    "grid-cols",
  );
  expect(view.getByText("Visitors see: Labour started → Baby born")).toBeTruthy();
  expect(
    view.getByText("We save this choice for your settings, but we don't show it to anyone."),
  ).toBeTruthy();
  expect(
    view.getByRole("switch", { name: "Show exact due date" }).getAttribute("aria-checked"),
  ).toBe("true");
  const dueDateSectionLabel = view.container.querySelector("[data-slot='label']");
  expect(dueDateSectionLabel?.textContent).toBe("Due date");
  expect(dueDateSectionLabel?.className).toContain("font-bold");
  expect(
    view.getAllByText("Due date").filter((element) => !element.classList.contains("sr-only")),
  ).toHaveLength(1);
  expect(view.getByLabelText("Due date")).toBeTruthy();
  expect(view.queryByLabelText("Public due date message")).toBeNull();
});

test.each([
  { label: "Labour", birthJourney: "labor" },
  { label: "Home birth", birthJourney: "home_birth" },
  { label: "Planned C-section", birthJourney: "planned_c_section" },
])("submits the $label selection", async (testCase) => {
  const createBaby = vi
    .fn<(args: unknown) => Promise<{ publicId: string }>>()
    .mockResolvedValue({ publicId: "baby-fern" });
  const navigate = vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined);
  await using view = await renderAddBaby({ createBaby, navigate });

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.change(view.getByLabelText("Due date"), {
    target: { value: "2026-09-09" },
  });
  fireEvent.click(view.getByRole("radio", { name: testCase.label }));
  fireEvent.click(view.getByRole("button", { name: "Add Baby 🍼" }));

  await vi.waitFor(() => {
    expect(createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: expect.stringContaining("2026-09-09"),
      dueDateDisplayMode: "exact",
      publicDueDateText: null,
      birthJourney: testCase.birthJourney,
    });
  });
  expect(navigate).toHaveBeenCalledWith({
    to: "/baby/$publicId",
    params: { publicId: "baby-fern" },
  });
});

test("allows a hidden public due date when message mode has no text", async () => {
  const createBaby = vi
    .fn<(args: unknown) => Promise<{ publicId: string }>>()
    .mockResolvedValue({ publicId: "baby-fern" });
  const navigate = vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined);
  await using view = await renderAddBaby({ createBaby, navigate });

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.click(view.getByRole("switch", { name: "Show exact due date" }));
  fireEvent.click(view.getByRole("button", { name: "Add Baby 🍼" }));

  await vi.waitFor(() => {
    expect(createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: null,
      dueDateDisplayMode: "message",
      publicDueDateText: null,
      birthJourney: "labor",
    });
  });
});

test("submits a custom public due date message when provided", async () => {
  const createBaby = vi
    .fn<(args: unknown) => Promise<{ publicId: string }>>()
    .mockResolvedValue({ publicId: "baby-fern" });
  const navigate = vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined);
  await using view = await renderAddBaby({ createBaby, navigate });

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.click(view.getByRole("switch", { name: "Show exact due date" }));
  const publicMessageInput = view.getByLabelText("Public due date message") as HTMLInputElement;
  fireEvent.change(publicMessageInput, {
    target: { value: "  Any day now  " },
  });
  fireEvent.click(view.getByRole("button", { name: "Add Baby 🍼" }));

  await vi.waitFor(() => {
    expect(createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: null,
      dueDateDisplayMode: "message",
      publicDueDateText: "Any day now",
      birthJourney: "labor",
    });
  });
});

test("toggles exact due date mode when clicking the row label", async () => {
  const createBaby = vi.fn<(args: unknown) => Promise<{ publicId: string }>>();
  const navigate = vi.fn<(args: unknown) => Promise<void>>();
  await using view = await renderAddBaby({ createBaby, navigate });

  const exactSwitch = view.getByRole("switch", { name: "Show exact due date" });
  expect(exactSwitch.getAttribute("aria-checked")).toBe("true");

  fireEvent.click(view.getByText("Visitors see the exact date and countdown."));
  expect(exactSwitch.getAttribute("aria-checked")).toBe("false");

  fireEvent.click(view.getByText("Show exact due date"));
  expect(exactSwitch.getAttribute("aria-checked")).toBe("true");
});

test("keeps entered date and message values while toggling fields", async () => {
  const createBaby = vi
    .fn<(args: unknown) => Promise<{ publicId: string }>>()
    .mockResolvedValue({ publicId: "baby-fern" });
  const navigate = vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined);
  await using view = await renderAddBaby({ createBaby, navigate });

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.change(view.getByLabelText("Due date"), {
    target: { value: "2026-09-19" },
  });
  const exactSwitch = view.getByRole("switch", { name: "Show exact due date" });
  fireEvent.click(exactSwitch);
  fireEvent.change(view.getByLabelText("Public due date message"), {
    target: { value: "Any day now" },
  });
  fireEvent.click(exactSwitch);
  expect((view.getByLabelText("Due date") as HTMLInputElement).value).toBe("2026-09-19");
  fireEvent.click(exactSwitch);
  expect((view.getByLabelText("Public due date message") as HTMLInputElement).value).toBe(
    "Any day now",
  );
  fireEvent.click(view.getByRole("button", { name: "Add Baby 🍼" }));

  await vi.waitFor(() => {
    expect(createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: expect.stringContaining("2026-09-19"),
      dueDateDisplayMode: "message",
      publicDueDateText: "Any day now",
      birthJourney: "labor",
    });
  });
});
