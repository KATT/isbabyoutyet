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
 * snapshot stays `false` for hydration.
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

/**
 * Drop-in `<img>` with a Next.js-style `blurDataURL` placeholder: the tiny
 * JPEG is the element's CSS background and is CSS-blurred until the real
 * `src` loads. TanStack Start/Router has no Image component of its own.
 */
export function BlurImage(props: BlurImageProps) {
  const { alt, blurDataUrl, className, onLoad, src, style, ...imgProps } = props;
  const srcKey = imageSrcKey(src);
  const alreadyDecoded = useDecodedImageSrc(src);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = alreadyDecoded || loadedSrc === srcKey;

  return (
    <img
      {...imgProps}
      alt={alt}
      src={src}
      className={cn(
        "transition-[filter,transform] duration-500",
        blurDataUrl && !loaded && "scale-105 blur-xl",
        className,
      )}
      style={{
        ...style,
        backgroundImage: blurDataUrl ? `url("${blurDataUrl}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      onLoad={(event) => {
        setLoadedSrc(srcKey);
        onLoad?.(event);
      }}
    />
  );
}
