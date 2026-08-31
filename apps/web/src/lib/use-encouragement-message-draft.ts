import { useEffect, useState } from "react";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import {
  clearEncouragementMessageDraft,
  ENCOURAGEMENT_MESSAGE_DRAFT_DEBOUNCE_MS,
  writeEncouragementMessageDraft,
} from "@/lib/encouragement-message-draft";

/**
 * Debounced sessionStorage sync for encouragement message bodies, keyed per
 * baby. Owns the restored-draft hint visibility for the inline guest form.
 */
export function useEncouragementMessageDraft(opts: {
  babyId: Id<"baby">;
  message: string;
  initialRestored: boolean;
}) {
  const [showRestoredHint, setShowRestoredHint] = useState(opts.initialRestored);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      writeEncouragementMessageDraft(opts.babyId, opts.message);
    }, ENCOURAGEMENT_MESSAGE_DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [opts.babyId, opts.message]);

  return {
    showRestoredHint,
    clearDraft() {
      clearEncouragementMessageDraft(opts.babyId);
      setShowRestoredHint(false);
    },
  };
}
