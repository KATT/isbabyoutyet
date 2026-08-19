import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { usePersistedWindowScroll } from "@/lib/use-persisted-window-scroll";

test("usePersistedWindowScroll restores scroll when the active key changes", () => {
  const scrollTo = vi.fn<(opts: ScrollToOptions) => void>();
  let scrollY = 900;

  vi.stubGlobal("scrollTo", scrollTo);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => scrollY,
  });

  const view = renderHook((props) => usePersistedWindowScroll(props.activeKey), {
    initialProps: { activeKey: "babies" },
  });

  scrollY = 900;
  view.rerender({ activeKey: "languages" });
  expect(scrollTo).toHaveBeenCalledWith({ top: 0 });

  scrollY = 120;
  view.rerender({ activeKey: "babies" });
  expect(scrollTo).toHaveBeenCalledWith({ top: 900 });

  view.unmount();
  vi.unstubAllGlobals();
});
