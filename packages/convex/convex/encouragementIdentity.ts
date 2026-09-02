import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { appIdentity } from "./authIdentity";

/**
 * Who authored (or is viewing) an encouragement. Resolved on the server from
 * the Convex auth token plus the browser visitor id — clients never send a
 * user id, so they cannot spoof ownership.
 */
export const encouragementAuthorValidator = v.union(
  v.object({
    type: v.literal("user"),
    userId: v.string(),
    visitorId: v.union(v.string(), v.null()),
  }),
  v.object({
    type: v.literal("visitor"),
    visitorId: v.string(),
  }),
);

export type EncouragementAuthor =
  | {
      type: "user";
      userId: string;
      visitorId: string | null;
    }
  | {
      type: "visitor";
      visitorId: string;
    };

export type EncouragementOwnership = {
  userId: string | null | undefined;
  visitorId: string;
};

export async function resolveEncouragementAuthor(
  ctx: Pick<QueryCtx, "auth">,
  visitorId: string | null,
): Promise<EncouragementAuthor | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    return {
      type: "user",
      userId: appIdentity(identity).authUserId,
      visitorId,
    };
  }
  if (visitorId) {
    return { type: "visitor", visitorId };
  }
  return null;
}

export function storedEncouragementUserId(author: EncouragementAuthor | null) {
  return author?.type === "user" ? author.userId : null;
}

export function encouragementIsMine(
  encouragement: EncouragementOwnership,
  author: EncouragementAuthor | null,
) {
  if (!author) {
    return false;
  }
  switch (author.type) {
    case "user": {
      if (encouragement.userId === author.userId) {
        return true;
      }
      return author.visitorId != null && encouragement.visitorId === author.visitorId;
    }
    case "visitor":
      return encouragement.visitorId === author.visitorId;
  }
  const _exhaustive: never = author;
  return _exhaustive;
}
