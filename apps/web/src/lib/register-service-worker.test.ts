import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";

type ServiceWorkerRegistrationLike = { scope: string };

function serviceWorkerResource(register: () => Promise<ServiceWorkerRegistrationLike>) {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register },
  });
  return makeResource({}, () => {
    if (descriptor) {
      Object.defineProperty(navigator, "serviceWorker", descriptor);
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
  });
}

test("registers the service worker during client bootstrap", async () => {
  const registration = { scope: "/" };
  const register = vi
    .fn<() => Promise<ServiceWorkerRegistrationLike>>()
    .mockResolvedValue(registration);
  await using _serviceWorker = serviceWorkerResource(register);
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  await using _log = makeResource({}, () => log.mockRestore());
  vi.resetModules();

  await import("./register-service-worker");
  await vi.waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js"));
  expect(log).toHaveBeenCalledWith("Service Worker registered:", registration);
});

test("reports service worker registration failures", async () => {
  const cause = new Error("registration failed");
  const register = vi
    .fn<() => Promise<ServiceWorkerRegistrationLike>>()
    .mockRejectedValue(cause);
  await using _serviceWorker = serviceWorkerResource(register);
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await using _error = makeResource({}, () => error.mockRestore());
  vi.resetModules();

  await import("./register-service-worker");
  await vi.waitFor(() =>
    expect(error).toHaveBeenCalledWith("Service Worker registration failed:", cause),
  );
});
