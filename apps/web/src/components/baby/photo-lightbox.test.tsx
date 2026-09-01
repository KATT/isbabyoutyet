import { fireEvent, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import { PhotoLightbox } from "./photo-lightbox";
import { renderResource } from "@/test/renderResource";

test("renders the photo and delegates the close control to overlay navigation", async () => {
  const close = vi.fn<() => void>();
  await using _view = renderResource(
    <LocaleProvider locale="en-GB">
      <PhotoLightbox
        alt="Photo of Nova"
        blurDataUrl="data:image/jpeg;base64,abc"
        overlay={{
          close,
          onOpenChange: vi.fn<(open: boolean) => void>(),
          onOpenChangeComplete: vi.fn<(open: boolean) => void>(),
          open: true,
        }}
        photoUrl="https://cdn.example/full.jpg"
      />
    </LocaleProvider>,
  );

  // The dialog renders into a portal, so query the whole document body.
  expect(screen.getByAltText("Photo of Nova")).toBeTruthy();
  // The lightbox supplies its own close button instead of the dialog's.
  expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close photo" }));
  expect(close).toHaveBeenCalled();
});
