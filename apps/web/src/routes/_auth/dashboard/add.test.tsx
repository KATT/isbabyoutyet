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
  createFileRoute: () => (options: { component: unknown }) => options,
  useRouter: () => ({ navigate: mocks.navigate }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.createBaby,
}));

const { AddBabyPage } = await import("./add");

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("journey choices explain visible statuses and privacy", async () => {
  await using view = renderResource(<AddBabyPage />);

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
  expect(view.getByRole("switch", { name: "Show exact due date" })).toBeChecked();
  expect(view.getByText("Turn this off to show only the due month.")).toBeTruthy();
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
  fireEvent.click(view.getByRole("radio", { name: testCase.label }));
  fireEvent.click(view.getByRole("button", { name: "Add Baby 🍼" }));

  await vi.waitFor(() => {
    expect(mocks.createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: expect.stringContaining("2026-09-09"),
      dueDateVisibility: "exact",
      birthJourney: testCase.birthJourney,
    });
  });
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: "/baby/$publicId",
    params: { publicId: "baby-fern" },
  });
});

test("can create a page that only shows the due month", async () => {
  mocks.createBaby.mockReset().mockResolvedValue({ publicId: "baby-fern" });
  mocks.navigate.mockReset().mockResolvedValue(undefined);
  await using view = renderResource(<AddBabyPage />);

  fireEvent.change(view.getByLabelText("Baby name"), {
    target: { value: "Baby Fern" },
  });
  fireEvent.change(view.getByLabelText("Due date"), {
    target: { value: "2026-09-19" },
  });
  fireEvent.click(view.getByRole("switch", { name: "Show exact due date" }));
  fireEvent.click(view.getByRole("button", { name: "Add Baby 🍼" }));

  await vi.waitFor(() => {
    expect(mocks.createBaby).toHaveBeenCalledWith({
      name: "Baby Fern",
      dueDate: expect.stringContaining("2026-09-19"),
      dueDateVisibility: "month",
      birthJourney: "labor",
    });
  });
});
