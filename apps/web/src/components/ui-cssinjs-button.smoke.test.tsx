import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "@workspace/ui-cssinjs/components/button";

describe("@workspace/ui-cssinjs Button", () => {
  it("renders with theme data attributes and primary styles", () => {
    const html = renderToStaticMarkup(
      <Button variant="default" size="default" className={undefined} render={undefined}>
        Save
      </Button>,
    );

    expect(html).toContain('data-slot="button"');
    expect(html).toContain('data-variant="default"');
    expect(html).toContain("Save");
  });
});
