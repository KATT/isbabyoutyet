import { z } from "zod";
import { lazyGetter } from "./utils";

export const convexEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(1),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
  CLOUDFLARE_EMAIL_API_TOKEN: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_FROM_PREVIEW: z.string().min(1).optional(),
  SITE_URL: z.url("SITE_URL must be a valid URL"),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().optional().default("mailto:admin@isbabyoutyet.com"),
  VERCEL_ENV: z.enum(["production", "preview"]).optional(),
});

export const convexEnv = lazyGetter(() => {
  return convexEnvSchema.parse(process.env);
});
