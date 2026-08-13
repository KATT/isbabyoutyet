import { render } from "@testing-library/react";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { HOMEPAGE_DEMO_BABIES, HOMEPAGE_DEMO_BABY } from "@workspace/convex/src/seedCredentials";
import { HomepageDemoToast } from "@/components/baby/homepage-demo-toast";

function renderToastResource(publicId: string) {
  const view = render(<HomepageDemoToast publicId={publicId} />);
  return makeResource(view, () => {
    view.unmount();
  });
}

function spyOnToastResource() {
  const custom = vi.spyOn(toast, "custom").mockReturnValue("toast-id");
  const dismiss = vi.spyOn(toast, "dismiss").mockReturnValue("toast-id");
  return makeResource({ custom, dismiss }, () => {
    custom.mockRestore();
    dismiss.mockRestore();
  });
}

test("shows a persistent demo toast on the homepage demo baby", async () => {
  await using spies = spyOnToastResource();
  await using _view = renderToastResource(HOMEPAGE_DEMO_BABY.publicId);

  expect(spies.custom).toHaveBeenCalledTimes(1);
  const [renderToast, options] = spies.custom.mock.calls[0] ?? [];
  expect(options).toMatchObject({
    duration: Infinity,
    closeButton: true,
  });
  expect(typeof renderToast).toBe("function");
});

test("does not toast on a real baby page, and dismisses when leaving the demo", async () => {
  await using spies = spyOnToastResource();

  {
    await using _demo = renderToastResource(HOMEPAGE_DEMO_BABY.publicId);
    expect(spies.custom).toHaveBeenCalledTimes(1);
  }

  const options = spies.custom.mock.calls[0]?.[1];
  if (!options || typeof options !== "object" || !("id" in options)) {
    throw new Error("expected toast options with an id");
  }
  expect(spies.dismiss).toHaveBeenCalledWith(options.id);

  spies.custom.mockClear();
  await using _other = renderToastResource("baby-waiting");
  expect(spies.custom).not.toHaveBeenCalled();
});

test("shows the demo toast on every locale homepage baby", async () => {
  await using spies = spyOnToastResource();
  await using _view = renderToastResource(HOMEPAGE_DEMO_BABIES.sv.publicId);
  expect(spies.custom).toHaveBeenCalledTimes(1);
});
