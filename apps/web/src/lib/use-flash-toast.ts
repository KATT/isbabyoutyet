import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";

/**
 * One-shot success toast for a URL flash, then clears the search param.
 * Lives in lib so the effect may own the toast + replace without putting
 * `useEffect` in a route.
 */
export function useFlashToast(opts: { message: string | null; onClear: () => void }) {
  const onClear = useEffectEvent(opts.onClear);

  useEffect(() => {
    if (opts.message === null) {
      return;
    }
    toast.success(opts.message, {
      id: opts.message,
    });
    onClear();
  }, [opts.message]);
}
