import { fireEvent, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { WelcomeTourDialog } from "@/components/onboarding/welcome-tour";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { makeResource } from "@workspace/convex/convex/test.resource";

/**
 * jsdom never lays anything out, so every element's `offsetWidth`/`offsetLeft`
 * is 0 and embla-carousel (which reads those, not `getBoundingClientRect`, to
 * compute scroll snaps) sees a single zero-sized slide and never advances.
 * Stub a simple horizontal flex layout — each element is `width` wide, and
 * `offsetLeft` is the sum of previous siblings' widths — so the real carousel
 * can compute distinct snap points and `scrollNext`/`scrollTo` actually move.
 */
function stubHorizontalLayoutResource(width: number) {
  const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  const offsetLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetLeft");

  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return width;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
    configurable: true,
    get() {
      let left = 0;
      for (
        let sibling = this.previousElementSibling;
        sibling;
        sibling = sibling.previousElementSibling
      ) {
        left += (sibling as HTMLElement).offsetWidth;
      }
      return left;
    },
  });

  return makeResource({}, () => {
    if (offsetWidth) {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", offsetWidth);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "offsetWidth");
    }
    if (offsetLeft) {
      Object.defineProperty(HTMLElement.prototype, "offsetLeft", offsetLeft);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "offsetLeft");
    }
  });
}

test("welcome tour renders overview slides and can be skipped", async () => {
  const onFinished = vi.fn<() => void>();
  const onOpenChange = vi.fn<(open: boolean) => void>();

  await using _view = await renderWithTestRouter(
    <WelcomeTourDialog open onOpenChange={onOpenChange} onFinished={onFinished} />,
  );

  expect(screen.getByText(/welcome! here's the idea/i)).toBeTruthy();
  expect(screen.getByText(/create a baby page/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: /^next$/i })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
  expect(onFinished).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("welcome tour finishes with Let's go on the last slide", async () => {
  const onFinished = vi.fn<() => void>();
  const onOpenChange = vi.fn<(open: boolean) => void>();

  // jsdom doesn't lay out elements, so give embla-carousel real widths/offsets
  // to compute against; otherwise scrollNext() never moves the selected slide.
  await using _layout = stubHorizontalLayoutResource(400);
  await using _view = await renderWithTestRouter(
    <WelcomeTourDialog open onOpenChange={onOpenChange} onFinished={onFinished} />,
  );

  // Jump via a slide dot (real carousel scrollTo), then finish from the last slide.
  fireEvent.click(screen.getByRole("button", { name: /go to slide 4/i }));

  await vi.waitFor(() => {
    expect(screen.getByRole("button", { name: /let's go/i })).toBeTruthy();
  });

  fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
  expect(onFinished).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
