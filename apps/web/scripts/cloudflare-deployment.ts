import { createHash } from "node:crypto";

const MAX_DNS_LABEL_LENGTH = 63;
const HASH_LENGTH = 4;
const ALIAS_VALIDATION_PATTERN = /^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const CLOUDFLARE_WORKER_NAME = "isbabyoutyet";

export function createCloudflarePreviewAlias(branchName: string, workerName: string) {
  const sanitizedAlias = branchName
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  if (!ALIAS_VALIDATION_PATTERN.test(sanitizedAlias)) {
    throw new Error(`Cannot create a Cloudflare preview alias from branch "${branchName}"`);
  }

  const availableSpace = MAX_DNS_LABEL_LENGTH - workerName.length - 1;
  if (sanitizedAlias.length <= availableSpace) {
    return sanitizedAlias;
  }

  const maxPrefixLength = availableSpace - HASH_LENGTH - 1;
  if (maxPrefixLength < 1) {
    throw new Error(`Cloudflare Worker name "${workerName}" leaves no room for a preview alias`);
  }

  const hash = createHash("sha256").update(branchName).digest("hex").slice(0, HASH_LENGTH);
  return `${sanitizedAlias.slice(0, maxPrefixLength)}-${hash}`;
}

export function normalizeWorkersSubdomain(value: string) {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\.workers\.dev$/, "");
}

export function createCloudflareSiteUrl(options: {
  branchName: string;
  productionBranch: string;
  workerName: string;
  workersSubdomain: string;
}) {
  const workerHost = `${options.workerName}.${options.workersSubdomain}.workers.dev`;
  if (options.branchName === options.productionBranch) {
    return `https://${workerHost}`;
  }

  const alias = createCloudflarePreviewAlias(options.branchName, options.workerName);
  return `https://${alias}-${workerHost}`;
}
