import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import * as z from "zod";

export const ENCOURAGEMENT_MESSAGE_DRAFT_DEBOUNCE_MS = 500;
const ENCOURAGEMENT_MESSAGE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const draftRecordSchema = z.object({
  message: z.string(),
  savedAt: z.number(),
});

function encouragementMessageDraftKey(babyId: Id<"baby">) {
  return `encouragement-message-draft:${babyId}`;
}

export function readEncouragementMessageDraft(babyId: Id<"baby">) {
  if (globalThis.sessionStorage === undefined) {
    return "";
  }
  const key = encouragementMessageDraftKey(babyId);
  const raw = sessionStorage.getItem(key);
  if (!raw) {
    return "";
  }
  try {
    const parsed = draftRecordSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      sessionStorage.removeItem(key);
      return "";
    }
    const record = parsed.data;
    if (Date.now() - record.savedAt > ENCOURAGEMENT_MESSAGE_DRAFT_TTL_MS) {
      sessionStorage.removeItem(key);
      return "";
    }
    return record.message;
  } catch {
    sessionStorage.removeItem(key);
    return "";
  }
}

export function writeEncouragementMessageDraft(babyId: Id<"baby">, message: string) {
  if (globalThis.sessionStorage === undefined) {
    return;
  }
  const key = encouragementMessageDraftKey(babyId);
  if (!message.trim()) {
    sessionStorage.removeItem(key);
    return;
  }
  try {
    const record = draftRecordSchema.parse({
      message,
      savedAt: Date.now(),
    });
    sessionStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Best effort — private mode / quota.
  }
}

export function clearEncouragementMessageDraft(babyId: Id<"baby">) {
  if (globalThis.sessionStorage === undefined) {
    return;
  }
  sessionStorage.removeItem(encouragementMessageDraftKey(babyId));
}
