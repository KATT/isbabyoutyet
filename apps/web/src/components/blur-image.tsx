import { useState, useSyncExternalStore } from "react";
import type { ImgHTMLAttributes } from "react";
import { cn } from "@workspace/ui/lib/utils";

type BlurImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
  blurDataUrl: string | null;
};

function imageSrcKey(src: BlurImageProps["src"]) {
  return typeof src === "string" ? src : "";
}

/**
 * Browser cache check: `new Image(); img.src = url` sets `complete` synchronously
 * when that URL is already decoded. Used as the client snapshot so a cached
 * photo skips the blur on first mount (SPA navigation), while the server
 * snapshot stays `false` so SSR HTML still includes the placeholder.
 */
function isDecodedImageSrc(src: string) {
  if (src === "") return false;
  const img = new Image();
  img.src = src;
  return img.complete && img.naturalWidth > 0;
}

function subscribeDecodedImageSrc(src: string, onStoreChange: () => void) {
  if (src === "") return () => {};
  const img = new Image();
  img.src = src;
  if (img.complete) return () => {};
  img.addEventListener("load", onStoreChange);
  img.addEventListener("error", onStoreChange);
  return () => {
    img.removeEventListener("load", onStoreChange);
    img.removeEventListener("error", onStoreChange);
  };
}

function useDecodedImageSrc(src: BlurImageProps["src"]) {
  const srcKey = imageSrcKey(src);
  return useSyncExternalStore(
    (onStoreChange) => subscribeDecodedImageSrc(srcKey, onStoreChange),
    () => isDecodedImageSrc(srcKey),
    () => false,
  );
}

function imgPropsWithoutBlur(props: BlurImageProps) {
  const { blurDataUrl: _blurDataUrl, ...imgProps } = props;
  return imgProps;
}

/**
 * Drop-in `<img>` with a Next.js-style `blurDataURL` placeholder. The real
 * `src` is always on the `<img>` (including SSR HTML) so the browser starts
 * fetching on first paint. The tiny JPEG lives on a sibling behind that img
 * and is CSS-blurred; because the real img is never filtered, a decoded
 * bitmap paints sharp before hydration. TanStack Start/Router has no Image
 * component of its own.
 */
export function BlurImage(props: BlurImageProps) {
  const srcKey = imageSrcKey(props.src);
  const alreadyDecoded = useDecodedImageSrc(props.src);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = alreadyDecoded || loadedSrc === srcKey;

  const image = (
    <img
      {...imgPropsWithoutBlur(props)}
      alt={props.alt}
      src={props.src}
      className={
        props.blurDataUrl === null ? props.className : cn("relative z-10", props.className)
      }
      onLoad={(event) => {
        setLoadedSrc(srcKey);
        props.onLoad?.(event);
      }}
    />
  );

  if (props.blurDataUrl === null) {
    return image;
  }

  return (
    <span className={cn("relative inline-grid overflow-hidden", props.className)}>
      <span
        aria-hidden="true"
        suppressHydrationWarning
        className={cn(
          "pointer-events-none absolute inset-0 z-0 scale-105 bg-cover bg-center blur-xl transition-opacity duration-500",
          loaded && "opacity-0",
        )}
        style={{ backgroundImage: `url("${props.blurDataUrl}")` }}
      />
      {image}
    </span>
  );
}
