import { fireEvent, render } from "@testing-library/react";
import { expect, test } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { HOMEPAGE_DEMO_BABIES, HOMEPAGE_DEMO_BABY } from "@workspace/convex/src/seedCredentials";
import { HomepageDemoToast } from "@/components/baby/homepage-demo-toast";

function renderToastResource(publicId: string) {
  const view = render(<HomepageDemoToast publicId={publicId} />);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("shows a persistent demo toast on the homepage demo baby", async () => {
  await using view = renderToastResource(HOMEPAGE_DEMO_BABY.publicId);

  // English locale maps the key "This is a demo baby" → "This is a demo page"
  expect(view.getByText("This is a demo page")).toBeTruthy();
  expect(
    view.getByText("Feel free to post test messages — we reset this demo daily."),
  ).toBeTruthy();
  expect(view.getByRole("complementary")).toBeTruthy();
});

test("does not render the notice on a real baby page", async () => {
  await using view = renderToastResource("baby-waiting");
  expect(view.container.firstChild).toBeNull();
});

test("shows the demo toast on every locale homepage baby", async () => {
  await using view = renderToastResource(HOMEPAGE_DEMO_BABIES.sv.publicId);
  expect(view.getByRole("complementary")).toBeTruthy();
});

test("can dismiss the notice and shows it again for another demo baby", async () => {
  await using view = renderToastResource(HOMEPAGE_DEMO_BABY.publicId);

  fireEvent.click(view.getByRole("button", { name: "Hide tip" }));
  expect(view.container.firstChild).toBeNull();

  view.rerender(<HomepageDemoToast publicId={HOMEPAGE_DEMO_BABIES.sv.publicId} />);
  expect(view.getByRole("complementary")).toBeTruthy();
});
