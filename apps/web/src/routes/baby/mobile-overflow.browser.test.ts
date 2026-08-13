import { commands } from "vitest/browser";
import { expect, test } from "vitest";

type PageCheckOptions = {
  path: string;
  heading: string;
  expectedText: string | null;
};

type OverflowResult = {
  documentWidth: number;
  viewportWidth: number;
  widest: {
    className: string;
    right: number;
    tagName: string;
  } | null;
};

declare module "vitest/browser" {
  interface BrowserCommands {
    measureMobileOverflow: (options: PageCheckOptions) => Promise<OverflowResult>;
  }
}

const fixtures = [
  {
    path: "/baby/mobile-overflow-status-test",
    heading: "Is Status Layout Probe out yet?",
    expectedText: null,
  },
  {
    path: "/baby/mobile-overflow-content-test",
    heading: "Is Content Layout Probe out yet?",
    expectedText: "overflow-fixture.test",
  },
] as const;

for (const fixture of fixtures) {
  test(`${fixture.path} fits within a 393px viewport`, async () => {
    const result = await commands.measureMobileOverflow({
      path: fixture.path,
      heading: fixture.heading,
      expectedText: fixture.expectedText,
    });

    expect(
      result.documentWidth,
      `widest element: ${JSON.stringify(result.widest)}`,
    ).toBeLessThanOrEqual(result.viewportWidth);
  });
}
