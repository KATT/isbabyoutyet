import { Dialog, DialogContent } from "@workspace/ui/components/dialog";
import { X } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import { BlurImage } from "@/components/blur-image";
import type { OverlayControl } from "@/lib/overlay-nav";
import * as stylex from "@stylexjs/stylex";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";

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
    backgroundColor: `color-mix(in oklab, ${colors.background} 80%, transparent)`,
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
    backdropFilter: "blur(4px)",
  },
  image: {
    borderRadius: "0.5rem",
    height: "auto",
    maxHeight: "80vh",
    width: "100%",
  },
});

export function PhotoLightbox(props: PhotoLightboxProps) {
  const { t } = useI18n();
  const imageSx = stylex.props(styles.image);

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
            className={imageSx.className}
            style={{ ...imageSx.style, objectFit: "contain" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
