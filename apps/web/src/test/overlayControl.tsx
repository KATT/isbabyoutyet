import type { ReactNode } from "react";
import { useFormGuard } from "@/components/Form";
import type { OverlayControl } from "@/lib/overlay-nav";

/**
 * Hands a presentational overlay component (`SettingsPanel`, `PhotoLightbox`,
 * `DashboardSettingsSheetView`) a real, controlled form guard so tests can
 * drive `open` and observe allowed closes without mounting a route overlay.
 */
export function WithOverlayControl(props: {
  children: (overlay: OverlayControl) => ReactNode;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete: (open: boolean) => void;
  open: boolean;
}) {
  const guard = useFormGuard({ onOpenChange: props.onOpenChange, open: props.open });
  return props.children({
    close: guard.close,
    guard,
    rootProps: { ...guard.rootProps, onOpenChangeComplete: props.onOpenChangeComplete },
  });
}
