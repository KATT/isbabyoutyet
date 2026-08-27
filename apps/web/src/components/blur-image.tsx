import type { CSSProperties, ImgHTMLAttributes } from "react";
import * as stylex from "@stylexjs/stylex";
import { customClassName } from "@workspace/ui/lib/utils.stylex";
import { useBlurImageLoad } from "@/lib/use-blur-image-load";

type BlurImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
  blurDataUrl: string | null;
  /** Placeholder / image object-fit. Defaults to `cover` when undefined. */
  objectFit: CSSProperties["objectFit"] | undefined;
};

const styles = stylex.create({
  wrapper: {
    display: "inline-grid",
    position: "relative",
  },
  placeholder: {
    borderRadius: "inherit",
    height: "100%",
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
    width: "100%",
  },
});

function imageSrcKey(src: BlurImageProps["src"]) {
  return typeof src === "string" ? src : "";
}

function numericDimension(value: BlurImageProps["width"] | BlurImageProps["height"]) {
  if (typeof value === "number") return value;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function placeholderObjectFit(props: BlurImageProps) {
  return props.objectFit ?? props.style?.objectFit ?? "cover";
}

type BlurSvgOptions = {
  width: number | undefined;
  height: number | undefined;
  blurDataUrl: string;
  objectFit: CSSProperties["objectFit"];
};

/**
 * Mirrors Next.js' SVG placeholder. Blurring a background image inside the
 * SVG avoids filtering the real replaced-image pixels on the `<img>`.
 * @see https://github.com/vercel/next.js/blob/78b11c37e6eafb92030612c08de4adb5bb5c8a28/packages/next/src/shared/lib/image-blur-svg.ts
 */
function getImageBlurSvg(options: BlurSvgOptions) {
  const std = 20;
  const viewBox =
    options.width && options.height ? `viewBox='0 0 ${options.width} ${options.height}'` : "";
  const preserveAspectRatio = viewBox
    ? "none"
    : options.objectFit === "contain"
      ? "xMidYMid"
      : options.objectFit === "cover"
        ? "xMidYMid slice"
        : "none";

  return `%3Csvg xmlns='http://www.w3.org/2000/svg' ${viewBox}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='${preserveAspectRatio}' style='filter: url(%23b);' href='${options.blurDataUrl}'/%3E%3C/svg%3E`;
}

function imgPropsWithoutBlur(props: BlurImageProps) {
  const {
    alt: _alt,
    blurDataUrl: _blurDataUrl,
    decoding: _decoding,
    objectFit: _objectFit,
    onError: _onError,
    onLoad: _onLoad,
    src: _src,
    style: _style,
    ...imgProps
  } = props;
  return imgProps;
}

/**
 * Drop-in `<img>` implementing Next.js' `blurDataURL` lifecycle. SSR keeps the
 * real `src` on the accessible image so loading starts immediately, while a
 * separate foreground layer prevents progressive JPEG scans from painting
 * over the placeholder before the full image has decoded.
 */
export function BlurImage(props: BlurImageProps) {
  const srcKey = imageSrcKey(props.src);
  const { imgRef, loaded, showAltText, onLoad, onError } = useBlurImageLoad({
    srcKey,
    onLoad: props.onLoad,
    onError: props.onError,
  });

  const objectFit = placeholderObjectFit(props);
  const placeholderSrc =
    props.blurDataUrl && !loaded
      ? `data:image/svg+xml;charset=utf-8,${getImageBlurSvg({
          width: numericDimension(props.width),
          height: numericDimension(props.height),
          blurDataUrl: props.blurDataUrl,
          objectFit,
        })}`
      : null;

  const image = (
    <img
      {...imgPropsWithoutBlur(props)}
      ref={imgRef}
      alt={props.alt}
      decoding={props.decoding ?? "async"}
      style={{
        color: showAltText ? undefined : "transparent",
        ...props.style,
      }}
      onLoad={onLoad}
      onError={onError}
      src={props.src}
    />
  );

  if (!props.blurDataUrl) return image;

  return (
    <span
      {...stylex.props(styles.wrapper, customClassName(props.className))}
      data-blur-image-wrapper=""
    >
      {image}
      {placeholderSrc ? (
        <img
          aria-hidden="true"
          alt=""
          {...stylex.props(styles.placeholder, customClassName(props.className))}
          data-blur-image-placeholder=""
          src={placeholderSrc}
          style={{
            objectFit,
            objectPosition: props.style?.objectPosition ?? "50% 50%",
          }}
        />
      ) : null}
    </span>
  );
}
