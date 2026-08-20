import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { BabyPageIndex } from "@/routes/baby/$publicId/index";

test("baby page index renders nothing so the layout owns the page chrome", async () => {
  const view = render(<BabyPageIndex />);
  await using _resource = makeResource(view, () => {
    view.unmount();
  });
  expect(view.container.childNodes.length).toBe(0);
});
