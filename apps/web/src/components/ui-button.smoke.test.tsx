import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";

describe("@workspace/ui components", () => {
  it("renders button with theme data attributes", () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('data-variant="default"');
    expect(html).toContain("Save");
  });

  it("renders badge, card, input, and spinner", () => {
    const html = renderToStaticMarkup(
      <>
        <Badge>New</Badge>
        <Card>
          <CardHeader>
            <CardTitle>Hello</CardTitle>
          </CardHeader>
        </Card>
        <Input aria-label="Name" />
        <Spinner />
      </>,
    );
    expect(html).toContain("New");
    expect(html).toContain("Hello");
    expect(html).toContain('aria-label="Name"');
    expect(html.length).toBeGreaterThan(20);
  });
});
