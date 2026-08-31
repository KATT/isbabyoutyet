import { useEffect } from "react";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import {
  ENCOURAGEMENT_MESSAGE_DRAFT_DEBOUNCE_MS,
  writeEncouragementMessageDraft,
} from "@/lib/encouragement-message-draft";

/**
 * Debounced sessionStorage sync for encouragement message bodies, keyed per
 * baby.
 */
export function useEncouragementMessageDraft(opts: { babyId: Id<"baby">; message: string }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      writeEncouragementMessageDraft(opts.babyId, opts.message);
    }, ENCOURAGEMENT_MESSAGE_DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [opts.babyId, opts.message]);
}
