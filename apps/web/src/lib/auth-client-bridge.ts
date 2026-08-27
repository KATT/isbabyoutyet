import type { AuthClient } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";

/**
 * Peer-type bridge: better-auth and @convex-dev/better-auth currently expose
 * structurally incompatible `AuthClient` types despite a compatible peer range.
 * Runtime behavior matches; this file is the only place we assert that.
 */
export function bridgedAuthClient(): AuthClient {
  return authClient as unknown as AuthClient;
}
