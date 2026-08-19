import { useLayoutEffect, useRef, useState } from "react";
import type { ImgHTMLAttributes } from "react";
import { cn } from "@workspace/ui/lib/utils";

type BlurImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
  blurDataUrl: string | null;
};

function imageAlreadyLoaded(img: HTMLImageElement | null) {
  return Boolean(img && img.complete && img.naturalWidth > 0);
}

/**
 * Drop-in `<img>` with a Next.js-style `blurDataURL` placeholder: the tiny
 * JPEG is the element's CSS background and is CSS-blurred until the real
 * `src` loads. TanStack Start/Router has no Image component of its own.
 */
export function BlurImage(props: BlurImageProps) {
  const { alt, blurDataUrl, className, onLoad, src, style, ...imgProps } = props;
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    setLoaded(imageAlreadyLoaded(imgRef.current));
  }, [src]);

  return (
    <img
      {...imgProps}
      ref={imgRef}
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
        setLoaded(true);
        onLoad?.(event);
      }}
    />
  );
}
