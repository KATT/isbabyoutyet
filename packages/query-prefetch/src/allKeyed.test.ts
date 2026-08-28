import { expect, test } from "vitest";
import { allKeyed } from "./allKeyed.js";

test("allKeyed resolves values by key", async () => {
  const result = await allKeyed({
    form: Promise.resolve("circle"),
    color: Promise.resolve("blue"),
    mass: 12,
  });

  expect(result).toEqual({ form: "circle", color: "blue", mass: 12 });
  expect(Object.getPrototypeOf(result)).toBeNull();
});

test("allKeyed rejects when any input rejects", async () => {
  await expect(
    allKeyed({
      ok: Promise.resolve(1),
      bad: Promise.reject(new Error("nope")),
    }),
  ).rejects.toThrow("nope");
});

test("allKeyed preserves symbol keys", async () => {
  const token = Symbol("token");
  const result = await allKeyed({
    [token]: Promise.resolve("secret"),
    name: Promise.resolve("ada"),
  });

  expect(result[token]).toBe("secret");
  expect(result.name).toBe("ada");
});
