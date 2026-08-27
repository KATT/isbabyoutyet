import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Box } from "@workspace/ui-patterns/components/box";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { VisuallyHidden } from "@workspace/ui-patterns/components/visually-hidden";

describe("@workspace/ui-patterns", () => {
  it("renders Stack, Box, Inline, Text, and VisuallyHidden", () => {
    const html = renderToStaticMarkup(
      <Stack gap="s2">
        <Box pad="s4">A</Box>
        <Inline gap="s1">
          <Text size="sm" tone="muted">
            B
          </Text>
          <VisuallyHidden>hidden</VisuallyHidden>
        </Inline>
      </Stack>,
    );
    expect(html).toContain('data-slot="stack"');
    expect(html).toContain('data-slot="box"');
    expect(html).toContain('data-slot="inline"');
    expect(html).toContain('data-slot="text"');
    expect(html).toContain('data-slot="visually-hidden"');
    expect(html).toContain(">A<");
  });
});
