import { fireEvent } from "@testing-library/react";
import type { NavigateOptions } from "@tanstack/react-router";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import { AddBabyPage, AddBabyPageView, Route, type CreateBaby } from "./dashboard_.add";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";

type NavigateFn = (args: NavigateOptions) => Promise<void>;

function createAddBabyMocks() {
  return {
    createBaby: vi
      .fn<CreateBaby>()
      .mockResolvedValue({ publicId: "baby-fern" } as Awaited<ReturnType<CreateBaby>>),
    navigate: vi.fn<NavigateFn>().mockResolvedValue(undefined),
  };
}

function renderAddBaby(opts: {
  createBaby: CreateBaby | undefined;
  navigate: NavigateFn | undefined;
}) {
  const mocks = createAddBabyMocks();
  return renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <AddBabyPageView
        createBaby={opts.createBaby ?? mocks.createBaby}
        navigate={opts.navigate ?? mocks.navigate}
      />
    </LocaleProvider>,
    { path: "/dashboard/add" },
  );
}

function renderDefaultAddBaby() {
  return renderAddBaby({
    createBaby: undefined,
    navigate: undefined,
  });
}

function expandOptionalSettings(view: Awaited<ReturnType<typeof renderAddBaby>>) {
  fireEvent.click(view.getByRole("button", { name: "Customize your page (optional)" }));
}

test("add baby remains a standalone non-nested dashboard route", () => {
  expect(Route.options.component).toBe(AddBabyPage);
});

test("optional settings stay collapsed until expanded", async () => {
  await using view = await renderDefaultAddBaby();

  expect(view.getByRole("button", { name: "Customize your page (optional)" })).toBeTruthy();
  expect(view.queryByRole("combobox", { name: "Presets" })).toBeNull();
  expect(view.queryByText("Birth journey")).toBeNull();

  expandOptionalSettings(view);

  expect(
    view.getByText(
      "You can change journey, theme, and other settings anytime after creating your page.",
    ),
  ).toBeTruthy();

  expect(view.getByRole("combobox", { name: "Presets" })).toBeTruthy();
  expect(view.getByText("Birth journey")).toBeTruthy();
  expect(view.getByText("Theme")).toBeTruthy();
});

test("name field explains it can be filled later", async () => {
  await using view = await renderDefaultAddBaby();

  expect(view.getByLabelText("Baby name")).toBeTruthy();
  expect(
    view.getByText("Optional. Leave it blank for now. You can change it later in Settings."),
  ).toBeTruthy();
});

test("journey choices explain visible statuses and privacy", async () => {
  const createBaby = vi.fn<CreateBaby>();
  const navigate = vi.fn<NavigateFn>();
  await using view = await renderAddBaby({ createBaby, navigate });

  expandOptionalSettings(view);

  expect(view.getByRole("combobox", { name: "Presets" }).textContent).toContain("Labour");
  expect(view.getByRole("switch", { name: "Labour started" }).getAttribute("aria-checked")).toBe(
    "true",
  );
  expect(view.getByRole("switch", { name: "Gone to hospital" }).getAttribute("aria-checked")).toBe(
    "true",
  );
  const babyBornSwitch = view.getByRole("switch", { name: "Baby born" });
  expect(
    babyBornSwitch.getAttribute("aria-disabled") ?? babyBornSwitch.getAttribute("disabled"),
  ).not.toBeNull();
  expect(
    view.getByText("Visitors see: Labour started → Gone to hospital → Baby born"),
  ).toBeTruthy();
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

test("submits optional theme selection", async () => {
  const createBaby = vi
    .fn<CreateBaby>()
    .mockResolvedValue({ publicId: "baby-fern" } as Awaited<ReturnType<CreateBaby>>);
  const navigate = vi.fn<NavigateFn>().mockResolvedValue(undefined);
  await using view = await renderAddBaby({ createBaby, navigate });

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.change(view.getByLabelText("Due date"), {
    target: { value: "2026-09-09" },
  });
  expandOptionalSettings(view);
  fireEvent.click(view.getByRole("button", { name: "Violet Bloom" }));
  fireEvent.click(view.getByRole("button", { name: "Add Baby" }));

  await vi.waitFor(() => {
    expect(createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: expect.stringContaining("2026-09-09"),
      dueDateDisplayMode: "exact",
      publicDueDateText: null,
      birthJourney: "labor",
      theme: "violet-bloom",
    });
  });
  expect(navigate).toHaveBeenCalledWith({
    to: "/baby/$publicId",
    params: { publicId: "baby-fern" },
  });
});

test.each([
  { label: "Labour", birthJourney: "labor" },
  { label: "Home birth", birthJourney: "home_birth" },
  { label: "Planned C-section", birthJourney: "planned_c_section" },
])("submits the $label selection", async (testCase) => {
  const createBaby = vi
    .fn<CreateBaby>()
    .mockResolvedValue({ publicId: "baby-fern" } as Awaited<ReturnType<CreateBaby>>);
  const navigate = vi.fn<NavigateFn>().mockResolvedValue(undefined);
  await using view = await renderAddBaby({ createBaby, navigate });

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.change(view.getByLabelText("Due date"), {
    target: { value: "2026-09-09" },
  });
  expandOptionalSettings(view);
  if (testCase.birthJourney !== "labor") {
    fireEvent.click(view.getByRole("combobox", { name: "Presets" }));
    const option = view.getByRole("option", { name: testCase.label });
    fireEvent.pointerDown(option, { pointerType: "mouse" });
    fireEvent.click(option);
  }
  fireEvent.click(view.getByRole("button", { name: "Add Baby" }));

  await vi.waitFor(() => {
    expect(createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: expect.stringContaining("2026-09-09"),
      dueDateDisplayMode: "exact",
      publicDueDateText: null,
      birthJourney: testCase.birthJourney,
      theme: null,
    });
  });
  expect(navigate).toHaveBeenCalledWith({
    to: "/baby/$publicId",
    params: { publicId: "baby-fern" },
  });
});

test("allows a hidden public due date when message mode has no text", async () => {
  const createBaby = vi
    .fn<CreateBaby>()
    .mockResolvedValue({ publicId: "baby-fern" } as Awaited<ReturnType<CreateBaby>>);
  const navigate = vi.fn<NavigateFn>().mockResolvedValue(undefined);
  await using view = await renderAddBaby({ createBaby, navigate });

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.click(view.getByRole("switch", { name: "Show exact due date" }));
  fireEvent.click(view.getByRole("button", { name: "Add Baby" }));

  await vi.waitFor(() => {
    expect(createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: null,
      dueDateDisplayMode: "message",
      publicDueDateText: null,
      birthJourney: "labor",
      theme: null,
    });
  });
});

test("submits a custom public due date message when provided", async () => {
  const createBaby = vi
    .fn<CreateBaby>()
    .mockResolvedValue({ publicId: "baby-fern" } as Awaited<ReturnType<CreateBaby>>);
  const navigate = vi.fn<NavigateFn>().mockResolvedValue(undefined);
  await using view = await renderAddBaby({ createBaby, navigate });

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.click(view.getByRole("switch", { name: "Show exact due date" }));
  const publicMessageInput = view.getByLabelText("Public due date message") as HTMLInputElement;
  fireEvent.change(publicMessageInput, {
    target: { value: "  Any day now  " },
  });
  fireEvent.click(view.getByRole("button", { name: "Add Baby" }));

  await vi.waitFor(() => {
    expect(createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: null,
      dueDateDisplayMode: "message",
      publicDueDateText: "Any day now",
      birthJourney: "labor",
      theme: null,
    });
  });
});

test("toggles exact due date mode when clicking the row label", async () => {
  const createBaby = vi.fn<CreateBaby>();
  const navigate = vi.fn<NavigateFn>();
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
    .fn<CreateBaby>()
    .mockResolvedValue({ publicId: "baby-fern" } as Awaited<ReturnType<CreateBaby>>);
  const navigate = vi.fn<NavigateFn>().mockResolvedValue(undefined);
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
  fireEvent.click(view.getByRole("button", { name: "Add Baby" }));

  await vi.waitFor(() => {
    expect(createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: expect.stringContaining("2026-09-19"),
      dueDateDisplayMode: "message",
      publicDueDateText: "Any day now",
      birthJourney: "labor",
      theme: null,
    });
  });
});
