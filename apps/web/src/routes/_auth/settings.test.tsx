import { expect, test } from "vitest";

const routeModule = await import("@/routes/_auth/settings");

function captureRedirect(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected redirect");
}

test("temporary settings URL redirects to the baby-scoped route", () => {
  const beforeLoad = routeModule.Route.options.beforeLoad as unknown as (opts: {
    search: { baby: string | undefined };
  }) => unknown;

  expect(captureRedirect(() => beforeLoad({ search: { baby: "baby-smith" } }))).toMatchObject({
    options: {
      to: "/baby/$publicId/settings",
      params: { publicId: "baby-smith" },
      replace: true,
    },
  });
});

test("bare settings URL redirects to the dashboard", () => {
  const beforeLoad = routeModule.Route.options.beforeLoad as unknown as (opts: {
    search: { baby: string | undefined };
  }) => unknown;

  expect(captureRedirect(() => beforeLoad({ search: { baby: undefined } }))).toMatchObject({
    options: { to: "/dashboard" },
  });
});
