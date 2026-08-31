import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { renderResource } from "@/test/renderResource";
import { NOTIFICATION_CLICK_MESSAGE } from "@/lib/notification-click";
import { useHashScroll } from "@/lib/use-hash-scroll";

function HashScrollHarness() {
  useHashScroll();
  return (
    <div>
      <div className="h-[2000px]">top</div>
      <section id="feed">Updates & messages</section>
    </div>
  );
}

test("smooth-scrolls to the hash landmark on load", async () => {
  window.location.hash = "#feed";
  await using _hash = makeResource({}, () => {
    window.location.hash = "";
  });
  const scrollIntoView = vi.fn();
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  await using _scroll = makeResource({}, () => {
    HTMLElement.prototype.scrollIntoView = originalScroll;
  });

  await using _view = renderResource(<HashScrollHarness />);

  expect(scrollIntoView).toHaveBeenCalledWith({
    behavior: "smooth",
    block: "start",
  });
});

test("scrolls again when the service worker posts a notification-click", async () => {
  window.location.hash = "#feed";
  await using _hash = makeResource({}, () => {
    window.location.hash = "";
  });
  const scrollIntoView = vi.fn();
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  await using _scroll = makeResource({}, () => {
    HTMLElement.prototype.scrollIntoView = originalScroll;
  });
  const listeners: EventListener[] = [];
  const addEventListener = vi.fn<(type: string, listener: EventListener) => void>(
    (type, listener) => {
      if (type === "message") {
        listeners.push(listener);
      }
    },
  );
  const removeEventListener = vi.fn();
  const originalServiceWorker = navigator.serviceWorker;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { addEventListener, removeEventListener },
  });
  await using _sw = makeResource({}, () => {
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: originalServiceWorker,
      });
      return;
    }
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  await using _view = renderResource(<HashScrollHarness />);
  scrollIntoView.mockClear();
  listeners[0]?.(new MessageEvent("message", { data: { type: NOTIFICATION_CLICK_MESSAGE } }));

  expect(scrollIntoView).toHaveBeenCalledOnce();
});
