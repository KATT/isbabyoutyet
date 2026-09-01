import { expect, test } from "vitest";
import { allKeyed } from "./allKeyed.js";

test("allKeyed resolves values by key", async () => {
  const result = await allKeyed({
    color: Promise.resolve("blue"),
    form: Promise.resolve("circle"),
    mass: 12,
  });

  expect(result).toEqual({ color: "blue", form: "circle", mass: 12 });
  expect(Object.getPrototypeOf(result)).toBeNull();
});

test("allKeyed rejects when any input rejects", async () => {
  await expect(
    allKeyed({
      bad: Promise.reject(new Error("nope")),
      ok: Promise.resolve(1),
    }),
  ).rejects.toThrow("nope");
});

test("allKeyed preserves symbol keys", async () => {
  const token = Symbol("token");
  const result = await allKeyed({
    name: Promise.resolve("ada"),
    [token]: Promise.resolve("secret"),
  });

  expect(result[token]).toBe("secret");
  expect(result.name).toBe("ada");
});
