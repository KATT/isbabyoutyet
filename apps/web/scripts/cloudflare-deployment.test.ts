import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createCloudflarePreviewAlias,
  createCloudflareSiteUrl,
  normalizeWorkersSubdomain,
} from "./cloudflare-deployment";

describe("createCloudflarePreviewAlias", () => {
  it("matches the alias normalization used by Workers Builds", () => {
    expect(createCloudflarePreviewAlias("Feature/Add_Baby", "isbabyoutyet")).toBe(
      "feature-add-baby",
    );
  });

  it("adds Wrangler's four-character hash when the DNS label would be too long", () => {
    const branchName = `feature/${"long-".repeat(12)}branch`;
    const expectedHash = createHash("sha256").update(branchName).digest("hex").slice(0, 4);
    const alias = createCloudflarePreviewAlias(branchName, "isbabyoutyet");

    expect(alias).toHaveLength(63 - "isbabyoutyet".length - 1);
    expect(alias).toMatch(new RegExp(`-${expectedHash}$`));
  });
});

describe("createCloudflareSiteUrl", () => {
  it("uses the Worker URL for the production branch", () => {
    expect(
      createCloudflareSiteUrl({
        branchName: "main",
        productionBranch: "main",
        workerName: "isbabyoutyet",
        workersSubdomain: "example",
      }),
    ).toBe("https://isbabyoutyet.example.workers.dev");
  });

  it("uses the stable branch alias for non-production branches", () => {
    expect(
      createCloudflareSiteUrl({
        branchName: "feature/cloudflare",
        productionBranch: "main",
        workerName: "isbabyoutyet",
        workersSubdomain: "example",
      }),
    ).toBe("https://feature-cloudflare-isbabyoutyet.example.workers.dev");
  });
});

describe("normalizeWorkersSubdomain", () => {
  it("accepts either a subdomain or a workers.dev URL", () => {
    expect(normalizeWorkersSubdomain("https://example.workers.dev/")).toBe("example");
    expect(normalizeWorkersSubdomain("example")).toBe("example");
  });
});
