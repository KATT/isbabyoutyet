import { betterAuth } from "better-auth/minimal";
import { createAuthMiddleware } from "better-auth/api";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import authConfig from "./auth.config";
import { components } from "./_generated/api";
import { env, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";
import { claimInvitesForAuthUser, ensureUserProfileForAuthUser } from "./profileBootstrap";

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export function resolveAuthBaseUrl(siteUrl: string | undefined, convexSiteUrl: string) {
  return siteUrl ?? convexSiteUrl;
}

function authMutationCtx(ctx: GenericCtx<DataModel>) {
  return ctx as MutationCtx;
}

function authUserFromReturned(returned: unknown) {
  if (!returned || typeof returned !== "object" || !("user" in returned)) {
    return null;
  }
  const user = returned.user;
  if (!user || typeof user !== "object" || !("id" in user)) {
    return null;
  }
  const userId = user.id;
  if (typeof userId !== "string") {
    return null;
  }
  const email = "email" in user && typeof user.email === "string" ? user.email : null;
  const name = "name" in user && typeof user.name === "string" ? user.name : null;
  return { userId, email, name };
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const mutationCtx = authMutationCtx(ctx);
  return betterAuth({
    // Fresh preview deployments run the demo seed before deploy-convex.ts can
    // set their branch URL. The Convex site URL is a safe bootstrap origin;
    // subsequent requests use the synced web preview URL.
    baseURL: resolveAuthBaseUrl(env.SITE_URL, env.CONVEX_SITE_URL),
    database: authComponent.adapter(ctx),
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
            await claimInvitesForAuthUser(mutationCtx, {
              userId: user.id,
              email: String(user.email),
              name: typeof user.name === "string" ? user.name : null,
            });
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            await claimInvitesForAuthUser(mutationCtx, {
              userId: String(session.userId),
              email: null,
              name: null,
            });
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email" && ctx.path !== "/sign-in/email") {
          return;
        }
        const authUser = authUserFromReturned(ctx.context.returned);
        if (!authUser) {
          return;
        }
        await ensureUserProfileForAuthUser(mutationCtx, {
          userId: authUser.userId,
          localeHint:
            ctx.headers?.get("accept-language") ?? ctx.request?.headers.get("accept-language"),
        });
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
