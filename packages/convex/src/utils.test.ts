import { expect, test, vi } from "vitest";
import { lazyGetter } from "./utils";

test("lazyGetter defers creation until first property access and caches it", () => {
  const factory = vi.fn(() => ({ greeting: "hello", count: 1 }));
  const value = lazyGetter(factory);

  expect(factory).not.toHaveBeenCalled();

  expect(value.greeting).toBe("hello");
  expect(value.count).toBe(1);
  expect(factory).toHaveBeenCalledTimes(1);
});
