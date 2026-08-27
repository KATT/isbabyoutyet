import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Box } from "@workspace/ui-patterns/components/box";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { Stack } from "@workspace/ui-patterns/components/stack";

describe("@workspace/ui-patterns", () => {
  it("renders Stack, Box, and Inline", () => {
    const html = renderToStaticMarkup(
      <Stack gap="s2">
        <Box pad="s4">A</Box>
        <Inline gap="s1">
          <span>B</span>
          <span>C</span>
        </Inline>
      </Stack>,
    );
    expect(html).toContain('data-slot="stack"');
    expect(html).toContain('data-slot="box"');
    expect(html).toContain('data-slot="inline"');
    expect(html).toContain(">A<");
  });
});
