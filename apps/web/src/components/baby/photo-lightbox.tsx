import * as stylex from "@stylexjs/stylex";
import { Dialog, DialogContent } from "@workspace/ui/components/dialog";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";
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

const styles = stylex.create({
  frame: {
    position: "relative",
  },
  close: {
    alignItems: "center",
    backdropFilter: "blur(4px)",
    backgroundColor: {
      ":hover": colors.background,
      default: `color-mix(in oklab, ${colors.background} 80%, transparent)`,
    },
    borderRadius: "9999px",
    borderStyle: "none",
    color: colors.foreground,
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    padding: spacing.s2,
    position: "absolute",
    right: 0,
    top: `calc(-1 * ${spacing.s12})`,
    transition: "background-color 0.15s",
  },
  image: {
    borderRadius: "0.5rem",
    height: "auto",
    maxHeight: "80vh",
    objectFit: "contain",
    width: "100%",
  },
});

export function PhotoLightbox(props: PhotoLightboxProps) {
  const { t } = useI18n();

  return (
    <Dialog
      open={props.overlay.open}
      onOpenChange={props.overlay.onOpenChange}
      onOpenChangeComplete={props.overlay.onOpenChangeComplete}
    >
      <DialogContent showCloseButton={false}>
        <div {...stylex.props(styles.frame)}>
          <button
            type="button"
            onClick={props.overlay.close}
            aria-label={t("Close photo")}
            {...stylex.props(styles.close)}
          >
            <X size={24} />
          </button>
          <BlurImage
            src={props.photoUrl}
            alt={props.alt}
            blurDataUrl={props.blurDataUrl}
            objectFit="contain"
            {...stylex.props(styles.image)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
