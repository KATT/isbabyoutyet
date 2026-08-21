import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { BabyPageIndex, Route } from "@/routes/baby/$publicId/index";

test("baby page index opts into tagged public caching", () => {
  const headers = Route.options.headers({
    params: { publicId: "juniper-hale" },
  } as never) as Record<string, string>;

  expect(headers["Cache-Control"]).toContain("public");
  expect(headers["Vercel-Cache-Tag"]).toContain("baby-public-id:juniper-hale");
});

test("baby page index renders nothing so the layout owns the page chrome", async () => {
  const view = render(<BabyPageIndex />);
  await using _resource = makeResource(view, () => {
    view.unmount();
  });
  expect(view.container.childNodes.length).toBe(0);
});
