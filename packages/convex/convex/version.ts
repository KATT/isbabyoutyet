import { v } from "convex/values";
import { env, query } from "./_generated/server";

export const gitSha = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async () => {
    return env.GIT_SHA ?? null;
  },
});
