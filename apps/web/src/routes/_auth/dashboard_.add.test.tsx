import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";

const mocks = vi.hoisted(() => ({
  createBaby: vi.fn<(args: unknown) => Promise<{ publicId: string }>>(),
  navigate: vi.fn<(args: unknown) => Promise<void>>(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: (props: React.ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"}>{props.children}</a>
  ),
  createFileRoute: (routeId: string) => (options: { component: unknown }) => ({
    ...options,
    routeId,
  }),
  useRouter: () => ({ navigate: mocks.navigate }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.createBaby,
}));

const routeModule = await import("./dashboard_.add");
const { AddBabyPage } = routeModule;

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

function expandOptionalSettings(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByRole("button", { name: "Customize your page (optional)" }));
}

test("add baby remains a standalone non-nested dashboard route", () => {
  const route = routeModule.Route as unknown as { routeId: string; component: unknown };
  expect(route.routeId).toBe("/_auth/dashboard_/add");
  expect(route.component).toBe(AddBabyPage);
});

test("optional settings stay collapsed until expanded", async () => {
  await using view = renderResource(<AddBabyPage />);

  expect(view.getByRole("button", { name: "Customize your page (optional)" })).toBeTruthy();
  expect(view.queryByRole("button", { name: "Labour" })).toBeNull();
  expect(view.queryByText("Birth journey")).toBeNull();

  expandOptionalSettings(view);

  expect(
    view.getByText(
      "You can change journey, theme, and other settings anytime after creating your page.",
    ),
  ).toBeTruthy();

  expect(view.getByRole("button", { name: "Labour" })).toBeTruthy();
  expect(view.getByText("Birth journey")).toBeTruthy();
  expect(view.getByText("Theme")).toBeTruthy();
});

test("name field explains a nickname is fine and can be changed later", async () => {
  await using view = renderResource(<AddBabyPage />);

  expect(view.getByLabelText("Baby name")).toBeTruthy();
  expect(
    view.getByText(
      "Don't worry if you don't know it yet. A nickname is fine — you can change it later.",
    ),
  ).toBeTruthy();
});

test("journey choices explain visible statuses and privacy", async () => {
  await using view = renderResource(<AddBabyPage />);

  expandOptionalSettings(view);

  expect(view.getByRole("button", { name: "Labour" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Home birth" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Planned C-section" })).toBeTruthy();
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
  mocks.createBaby.mockReset().mockResolvedValue({ publicId: "baby-fern" });
  mocks.navigate.mockReset().mockResolvedValue(undefined);
  await using view = renderResource(<AddBabyPage />);

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.change(view.getByLabelText("Due date"), {
    target: { value: "2026-09-09" },
  });
  expandOptionalSettings(view);
  fireEvent.click(view.getByRole("button", { name: "Violet Bloom" }));
  fireEvent.click(view.getByRole("button", { name: "Add Baby 🍼" }));

  await vi.waitFor(() => {
    expect(mocks.createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: expect.stringContaining("2026-09-09"),
      dueDateDisplayMode: "exact",
      publicDueDateText: null,
      birthJourney: "labor",
      theme: "violet-bloom",
    });
  });
});

test.each([
  { label: "Labour", birthJourney: "labor" },
  { label: "Home birth", birthJourney: "home_birth" },
  { label: "Planned C-section", birthJourney: "planned_c_section" },
])("submits the $label selection", async (testCase) => {
  mocks.createBaby.mockReset().mockResolvedValue({ publicId: "baby-fern" });
  mocks.navigate.mockReset().mockResolvedValue(undefined);
  await using view = renderResource(<AddBabyPage />);

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.change(view.getByLabelText("Due date"), {
    target: { value: "2026-09-09" },
  });
  expandOptionalSettings(view);
  fireEvent.click(view.getByRole("button", { name: testCase.label }));
  fireEvent.click(view.getByRole("button", { name: "Add Baby 🍼" }));

  await vi.waitFor(() => {
    expect(mocks.createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: expect.stringContaining("2026-09-09"),
      dueDateDisplayMode: "exact",
      publicDueDateText: null,
      birthJourney: testCase.birthJourney,
      theme: null,
    });
  });
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: "/baby/$publicId",
    params: { publicId: "baby-fern" },
  });
});

test("allows a hidden public due date when message mode has no text", async () => {
  mocks.createBaby.mockReset().mockResolvedValue({ publicId: "baby-fern" });
  mocks.navigate.mockReset().mockResolvedValue(undefined);
  await using view = renderResource(<AddBabyPage />);

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.click(view.getByRole("switch", { name: "Show exact due date" }));
  fireEvent.click(view.getByRole("button", { name: "Add Baby 🍼" }));

  await vi.waitFor(() => {
    expect(mocks.createBaby).toHaveBeenCalledWith({
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
  mocks.createBaby.mockReset().mockResolvedValue({ publicId: "baby-fern" });
  mocks.navigate.mockReset().mockResolvedValue(undefined);
  await using view = renderResource(<AddBabyPage />);

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
    expect(mocks.createBaby).toHaveBeenCalledWith({
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
  await using view = renderResource(<AddBabyPage />);

  const exactSwitch = view.getByRole("switch", { name: "Show exact due date" });
  expect(exactSwitch.getAttribute("aria-checked")).toBe("true");

  fireEvent.click(view.getByText("Visitors see the exact date and countdown."));
  expect(exactSwitch.getAttribute("aria-checked")).toBe("false");

  fireEvent.click(view.getByText("Show exact due date"));
  expect(exactSwitch.getAttribute("aria-checked")).toBe("true");
});

test("keeps entered date and message values while toggling fields", async () => {
  mocks.createBaby.mockReset().mockResolvedValue({ publicId: "baby-fern" });
  mocks.navigate.mockReset().mockResolvedValue(undefined);
  await using view = renderResource(<AddBabyPage />);

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
    expect(mocks.createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: expect.stringContaining("2026-09-19"),
      dueDateDisplayMode: "message",
      publicDueDateText: "Any day now",
      birthJourney: "labor",
      theme: null,
    });
  });
});
