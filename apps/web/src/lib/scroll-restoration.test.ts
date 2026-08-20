import { expect, test } from "vitest";
import { getScrollRestorationKey } from "@/lib/scroll-restoration";

function location(pathname: string, search: Record<string, string> = {}) {
  const searchStr = new URLSearchParams(search).toString();
  return {
    pathname,
    searchStr,
    href: searchStr ? `${pathname}?${searchStr}` : pathname,
  } as Parameters<typeof getScrollRestorationKey>[0];
}

test("getScrollRestorationKey treats /settings as overlay on the parent page", () => {
  expect(getScrollRestorationKey(location("/baby/demo"))).toBe("/baby/demo");
  expect(getScrollRestorationKey(location("/baby/demo/settings"))).toBe("/baby/demo");
  expect(getScrollRestorationKey(location("/preview/settings"))).toBe("/preview");
});

test("getScrollRestorationKey keeps separate keys per admin tab", () => {
  const babies = location("/dashboard/admin", { tab: "babies" });
  const languages = location("/dashboard/admin", { tab: "languages" });

  expect(getScrollRestorationKey(babies)).toBe("/dashboard/admin?tab=babies");
  expect(getScrollRestorationKey(languages)).toBe("/dashboard/admin?tab=languages");
});
