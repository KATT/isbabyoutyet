import { fireEvent, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { BlurImage } from "./blur-image";
import { makeResource } from "@workspace/convex/convex/test.resource";

const BLUR = "data:image/jpeg;base64,/9j/blur";

function placeholderOf(img: HTMLImageElement) {
  return img.previousElementSibling as HTMLElement | null;
}

test("paints the blur data URL until the image loads", () => {
  const view = render(
    <BlurImage src="https://example.com/photo.jpg" alt="Nova" blurDataUrl={BLUR} />,
  );
  using _view = makeResource(view, () => {
    view.unmount();
  });

  const img = view.getByAltText("Nova") as HTMLImageElement;
  const placeholder = placeholderOf(img);
  expect(img.src).toContain("photo.jpg");
  expect(img.className).not.toContain("blur-xl");
  expect(placeholder).toBeTruthy();
  expect(placeholder?.style.backgroundImage).toContain(BLUR);
  expect(placeholder?.className).toContain("blur-xl");
  expect(placeholder?.className).toContain("z-20");
  expect(img.className).toContain("z-10");
  expect(placeholder?.className).not.toContain("opacity-0");

  fireEvent.load(img);
  expect(img.className).not.toContain("blur-xl");
  expect(placeholderOf(img)?.className).toContain("opacity-0");
});

test("skips the blur on first client mount when the image is already decoded", () => {
  const OriginalImage = window.Image;
  window.Image = class DecodedImage {
    complete = true;
    naturalWidth = 160;
    naturalHeight = 160;
    src = "";
    addEventListener() {}
    removeEventListener() {}
  } as unknown as typeof Image;
  using _restoreImage = makeResource({}, () => {
    window.Image = OriginalImage;
  });

  const view = render(
    <BlurImage src="https://example.com/cached.jpg" alt="Nova" blurDataUrl={BLUR} />,
  );
  using _view = makeResource(view, () => {
    view.unmount();
  });

  const img = view.getByAltText("Nova") as HTMLImageElement;
  expect(img.className).not.toContain("blur-xl");
  expect(placeholderOf(img)?.className).toContain("opacity-0");
});

test("skips the placeholder when no blur data URL is provided", () => {
  const view = render(
    <BlurImage src="https://example.com/photo.jpg" alt="Nova" blurDataUrl={null} />,
  );
  using _view = makeResource(view, () => {
    view.unmount();
  });

  const img = view.getByAltText("Nova") as HTMLImageElement;
  expect(placeholderOf(img)).toBeNull();
  expect(img.style.backgroundImage).toBe("");
  expect(img.className).not.toContain("blur-xl");
});

test("starts the real src behind the blur placeholder in server HTML", () => {
  const html = renderToString(
    <BlurImage src="https://cdn.example/full.jpg" alt="Nova" blurDataUrl={BLUR} />,
  );

  expect(html).toContain('src="https://cdn.example/full.jpg"');
  expect(html).toContain(BLUR);
  expect(html).toContain("blur-xl");
  expect(html).toContain("z-20");
  expect(html).not.toMatch(/<img\b[^>]*blur-xl/);
});
