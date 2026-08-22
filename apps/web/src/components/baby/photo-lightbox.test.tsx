import { fireEvent, render } from "@testing-library/react";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";

vi.mock("@workspace/ui/components/dialog", async () => {
  const React = await import("react");
  function MockDialog(props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenChangeComplete: ((open: boolean) => void) | undefined;
    children: ReactNode;
  }) {
    const wasOpen = React.useRef(props.open);
    React.useEffect(() => {
      if (wasOpen.current && !props.open) {
        props.onOpenChangeComplete?.(false);
      }
      wasOpen.current = props.open;
    }, [props.open, props.onOpenChangeComplete]);
    return <div data-testid="dialog">{props.children}</div>;
  }
  return {
    Dialog: MockDialog,
    DialogContent: (props: { children: ReactNode; showCloseButton: boolean | undefined }) => (
      <div data-show-close={props.showCloseButton ?? true}>{props.children}</div>
    ),
  };
});

const { PhotoLightbox } = await import("./photo-lightbox");

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

  expect(view.getByAltText("Photo of Nova")).toBeTruthy();
  expect(view.container.querySelector("[data-show-close='false']")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Close photo" }));
  expect(close).toHaveBeenCalled();
});
