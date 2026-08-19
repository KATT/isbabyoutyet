import { fireEvent, render } from "@testing-library/react";
import { expect, test } from "vitest";
import { BlurImage } from "./blur-image";
import { makeResource } from "@workspace/convex/convex/test.resource";

const BLUR = "data:image/jpeg;base64,/9j/blur";

test("paints the blur data URL until the image loads", () => {
  const view = render(
    <BlurImage src="https://example.com/photo.jpg" alt="Nova" blurDataUrl={BLUR} />,
  );
  using _view = makeResource(view, () => {
    view.unmount();
  });

  const img = view.getByAltText("Nova") as HTMLImageElement;
  expect(img.src).toContain("photo.jpg");
  expect(img.style.backgroundImage).toContain(BLUR);
  expect(img.className).toContain("blur-xl");

  fireEvent.load(img);
  expect(img.className).not.toContain("blur-xl");
});

test("skips the placeholder when no blur data URL is provided", () => {
  const view = render(
    <BlurImage src="https://example.com/photo.jpg" alt="Nova" blurDataUrl={null} />,
  );
  using _view = makeResource(view, () => {
    view.unmount();
  });

  const img = view.getByAltText("Nova") as HTMLImageElement;
  expect(img.style.backgroundImage).toBe("");
  expect(img.className).not.toContain("blur-xl");
});
