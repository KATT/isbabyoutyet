import { v } from "convex/values";

export const onboardingStepIdValidator = v.union(
  v.literal("add_baby"),
  v.literal("share_link"),
  v.literal("post_update"),
  v.literal("explore_settings"),
  /** @deprecated Retired in #156; kept for prod schema validation until sanitizeOnboardingSteps runs. */
  v.literal("learn_encouragements"),
);
