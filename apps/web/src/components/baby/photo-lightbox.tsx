import { Dialog, DialogContent } from "@workspace/ui/components/dialog";
import { X } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import { BlurImage } from "@/components/blur-image";
import type { OverlayControl } from "@/lib/overlay-nav";

type PhotoLightboxProps = {
  photoUrl: string;
  blurDataUrl: string | null;
  alt: string;
  overlay: OverlayControl;
};

export function PhotoLightbox(props: PhotoLightboxProps) {
  const { t } = useI18n();

  return (
    <Dialog
      open={props.overlay.open}
      onOpenChange={props.overlay.onOpenChange}
      onOpenChangeComplete={props.overlay.onOpenChangeComplete}
    >
      <DialogContent
        className="max-w-3xl border-0 bg-transparent p-0 shadow-none"
        showCloseButton={false}
      >
        <button
          type="button"
          onClick={props.overlay.close}
          aria-label={t("Close photo")}
          className="absolute -top-12 right-0 rounded-full bg-background/80 p-2 text-foreground backdrop-blur-sm transition-colors hover:bg-background"
        >
          <X className="h-6 w-6" />
        </button>
        <BlurImage
          src={props.photoUrl}
          alt={props.alt}
          blurDataUrl={props.blurDataUrl}
          className="h-auto max-h-[80vh] w-full rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
