import { fireEvent, render, screen } from "@testing-library/react";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import { PhotoLightbox } from "./photo-lightbox";

test("renders the photo and delegates the close control to overlay navigation", async () => {
  const close = vi.fn<() => void>();
  const view = render(
    <LocaleProvider locale="en-GB">
      <PhotoLightbox
        photoUrl="https://cdn.example/full.jpg"
        blurDataUrl="data:image/jpeg;base64,abc"
        alt="Photo of Nova"
        overlay={{
          open: true,
          close,
          onOpenChange: vi.fn<(open: boolean) => void>(),
          onOpenChangeComplete: vi.fn<(open: boolean) => void>(),
        }}
      />
    </LocaleProvider>,
  );
  await using _view = makeResource(view, () => {
    view.unmount();
  });

  // The dialog renders into a portal, so query the whole document body.
  expect(screen.getByAltText("Photo of Nova")).toBeTruthy();
  // The lightbox supplies its own close button instead of the dialog's.
  expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close photo" }));
  expect(close).toHaveBeenCalled();
});
