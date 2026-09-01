import { expect, test } from "vitest";
import {
  babyLoginHomeLink,
  babyLoginSuccessTarget,
  loginRedirectQuery,
  parseBabyLoginPublicId,
} from "./baby-login-redirect";

test("loginRedirectQuery reads the query string", () => {
  expect(loginRedirectQuery("?redirect=/baby/baby-waiting")).toBe("/baby/baby-waiting");
  expect(loginRedirectQuery("redirect=/baby/baby-waiting")).toBe("/baby/baby-waiting");
  expect(loginRedirectQuery("")).toBeUndefined();
});

test.each([
  { publicId: "baby-waiting", redirect: "/baby/baby-waiting" },
  { publicId: "juniper-hale", redirect: "/baby/juniper-hale" },
])("allowlists the baby page $redirect", (testCase) => {
  expect(parseBabyLoginPublicId(testCase.redirect)).toBe(testCase.publicId);
  expect(babyLoginSuccessTarget(testCase.redirect)).toEqual({
    params: { publicId: testCase.publicId },
    to: "/baby/$publicId",
  });
  expect(babyLoginHomeLink(testCase.redirect)).toEqual({
    params: { publicId: testCase.publicId },
    to: "/baby/$publicId",
  });
});

test.each([
  undefined,
  "",
  "/dashboard",
  "/auth/login",
  "//evil.example",
  "/baby//evil",
  "https://evil.example/baby/baby-waiting",
  "/baby/baby-waiting/settings",
  "/baby/baby-waiting?next=https://evil.example",
  "/baby/baby-waiting#feed",
  "/baby/../dashboard",
  "/baby/%2e%2e",
  "/baby/",
  "/baby/foo.bar",
  String.raw`/baby/baby\waiting`,
  "baby-waiting",
])("rejects %s as a login redirect", (redirect) => {
  expect(parseBabyLoginPublicId(redirect)).toBeNull();
  expect(babyLoginSuccessTarget(redirect)).toEqual({ to: "/dashboard" });
  expect(babyLoginHomeLink(redirect)).toEqual({ to: "/" });
});
