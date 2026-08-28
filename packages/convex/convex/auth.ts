import { betterAuth } from "better-auth/minimal";
import { createAuthMiddleware } from "better-auth/api";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import authConfig from "./auth.config";
import { components, internal } from "./_generated/api";
import { env, query } from "./_generated/server";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";
import { TIME_ZONE_HINT_HEADER } from "../src/timeZone";
import { isJsonObjectValue, parseOptionalString } from "@workspace/runtime/json";

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export function resolveAuthBaseUrl(siteUrl: string | undefined, convexSiteUrl: string) {
  return siteUrl ?? convexSiteUrl;
}

function requireAuthMutationCtx(ctx: GenericCtx<DataModel>) {
  if (!("runMutation" in ctx)) {
    throw new Error("Auth hooks require a context that can run mutations");
  }
  return ctx;
}

/** Parsed Better Auth email auth user extracted from middleware returned. */
type AuthEndpointUser = {
  readonly userId: string;
  readonly email: string | null;
  readonly name: string | null;
};

function parseAuthUserFromReturned<TReturned>(returned: TReturned): AuthEndpointUser | null {
  if (!isJsonObjectValue(returned) || !("user" in returned)) {
    return null;
  }
  const user = returned.user;
  if (!isJsonObjectValue(user)) {
    return null;
  }
  const userId = "id" in user ? parseOptionalString(user.id) : null;
  if (userId === null) {
    return null;
  }
  const email = "email" in user ? parseOptionalString(user.email) : null;
  const name = "name" in user ? parseOptionalString(user.name) : null;
  return { userId, email, name };
}

export const createAuth = (convexCtx: GenericCtx<DataModel>) => {
  return betterAuth({
    // Fresh preview deployments run the demo seed before deploy-convex.ts can
    // set their branch URL. The Convex site URL is a safe bootstrap origin;
    // subsequent requests use the synced web preview URL.
    baseURL: resolveAuthBaseUrl(env.SITE_URL, env.CONVEX_SITE_URL),
    database: authComponent.adapter(convexCtx),
    // Configure simple, non-verified email/password to get started
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (!user.email) {
              return;
            }
            await requireAuthMutationCtx(convexCtx).runMutation(
              internal.profileBootstrap.claimInvitesForAuthUserMutation,
              {
                userId: user.id,
                email: String(user.email),
                name: parseOptionalString(user.name),
              },
            );
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            await requireAuthMutationCtx(convexCtx).runMutation(
              internal.profileBootstrap.claimInvitesForAuthUserMutation,
              {
                userId: String(session.userId),
                email: null,
                name: null,
              },
            );
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email" && ctx.path !== "/sign-in/email") {
          return;
        }
        const authUser = parseAuthUserFromReturned(ctx.context.returned);
        if (!authUser) {
          return;
        }
        await requireAuthMutationCtx(convexCtx).runMutation(
          internal.profileBootstrap.ensureUserProfileForAuthUserMutation,
          {
            userId: authUser.userId,
            localeHint:
              ctx.headers?.get("accept-language") ??
              ctx.request?.headers.get("accept-language") ??
              null,
            timeZoneHint:
              ctx.headers?.get(TIME_ZONE_HINT_HEADER) ??
              ctx.request?.headers.get(TIME_ZONE_HINT_HEADER) ??
              null,
          },
        );
      }),
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
    ],
  });
};

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx);
  },
});
