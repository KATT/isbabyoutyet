import * as z from "zod";
import { proxied } from "./utils";

export const envSchema = z.object({
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
  VERCEL_BRANCH_URL: z.string().min(1), // The domain name of the Git branch URL
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
