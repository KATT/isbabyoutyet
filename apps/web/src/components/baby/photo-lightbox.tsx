import { Dialog, DialogContent } from "@workspace/ui/components/dialog";
import { X } from "@phosphor-icons/react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { BlurImage } from "@/components/blur-image";

type PhotoLightboxProps = {
  photoUrl: string;
  blurDataUrl: string | null;
  alt: string;
  onDismiss: () => void;
};

/**
 * Route-backed full-photo overlay. Local `open` lets the exit animation finish
 * before `onDismiss` (overlay-nav dismiss / history.back).
 */
export function PhotoLightbox(props: PhotoLightboxProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setOpen(false);
        }
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          props.onDismiss();
        }
      }}
    >
      <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
          }}
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
