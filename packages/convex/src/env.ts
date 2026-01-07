import * as z from "zod";
import { proxied } from "./utils";

export const envSchema = z.object({
  NODE_ENV: z.enum(["production", "development", "test"]),
  // Better Auth secret for signing tokens and encrypting data
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),

  // VAPID keys for push notifications
  VAPID_PUBLIC_KEY: z.string().min(1, "VAPID_PUBLIC_KEY is required"),
  VAPID_PRIVATE_KEY: z.string().min(1, "VAPID_PRIVATE_KEY is required"),
  VAPID_SUBJECT: z.string().optional().default("mailto:admin@isbabyoutyet.com"),

  VITE_CONVEX_URL: z.url("VITE_CONVEX_URL must be a valid URL").optional(),

  // Vercel system environment variables
  // See: https://vercel.com/docs/environment-variables/system-environment-variables
  VERCEL_ENV: z.enum(["production", "preview", "development"]),
  VERCEL_GIT_COMMIT_REF: z.string().min(1), // The git branch of the commit
  VERCEL_GIT_COMMIT_SHA: z.string().min(1), // The git SHA of the commit
  VERCEL_URL: z.string().min(1), // The domain name of the deployment URL
  VERCEL_BRANCH_URL: z.string().min(1), // The domain name of the Git branch URL
  VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1), // A production domain name
  VERCEL_DEPLOYMENT_ID: z.string().min(1), // Unique identifier for the deployment
  VERCEL_PROJECT_ID: z.string().min(1), // Unique identifier for the project

  // Fallback environment variables (for non-Vercel CI systems)
  GIT_BRANCH: z.string().optional(),
  BRANCH_NAME: z.string().optional(),

  // Custom environment variables
  PREVIEW: z.string().optional(), // For local testing: set PREVIEW=true
  CONVEX_PREVIEW_DEPLOY_KEY: z.string().optional(), // Custom preview deploy key
  CONVEX_DEPLOY_KEY: z.string().min(1, "CONVEX_DEPLOY_KEY is required"),
});

export const convexEnvSchema = envSchema
  .pick({
    BETTER_AUTH_SECRET: true,
    VAPID_PUBLIC_KEY: true,
    VAPID_PRIVATE_KEY: true,
    VAPID_SUBJECT: true,
  })
  .extend({
    SITE_URL: z.url("SITE_URL must be a valid URL"),
  });

export const convexEnv = proxied(() => {
  return convexEnvSchema.parse(process.env);
});
