import { expect, test } from "vitest";
import { lazyGetter } from "../src/utils";

test("lazyGetter creates its value once on the first property read", () => {
  let calls = 0;
  const value = lazyGetter(() => {
    calls += 1;
    return { name: "Ada", count: 3 };
  });

  expect(calls).toBe(0);
  expect(value.name).toBe("Ada");
  expect(value.count).toBe(3);
  expect(calls).toBe(1);
});
