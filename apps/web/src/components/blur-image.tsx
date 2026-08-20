import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, Dispatch, ImgHTMLAttributes, RefObject, SetStateAction } from "react";

type BlurImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
  blurDataUrl: string | null;
};

function imageSrcKey(src: BlurImageProps["src"]) {
  return typeof src === "string" ? src : "";
}

function numericDimension(value: BlurImageProps["width"] | BlurImageProps["height"]) {
  if (typeof value === "number") return value;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function placeholderObjectFit(props: BlurImageProps) {
  if (props.style?.objectFit) return props.style.objectFit;

  const className = ` ${props.className ?? ""} `;
  if (className.includes(" object-contain ")) return "contain";
  if (className.includes(" object-fill ")) return "fill";
  if (className.includes(" object-none ")) return "none";
  if (className.includes(" object-scale-down ")) return "scale-down";
  return "cover";
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
    onError: _onError,
    onLoad: _onLoad,
    src: _src,
    style: _style,
    ...imgProps
  } = props;
  return imgProps;
}

function callOnLoad(img: HTMLImageElement, onLoad: ImgHTMLAttributes<HTMLImageElement>["onLoad"]) {
  if (!onLoad) return;

  const nativeEvent = new Event("load");
  Object.defineProperty(nativeEvent, "target", { writable: false, value: img });
  let prevented = false;
  let stopped = false;

  onLoad({
    ...nativeEvent,
    nativeEvent,
    currentTarget: img,
    target: img,
    isDefaultPrevented: () => prevented,
    isPropagationStopped: () => stopped,
    persist: () => {},
    preventDefault: () => {
      prevented = true;
      nativeEvent.preventDefault();
    },
    stopPropagation: () => {
      stopped = true;
      nativeEvent.stopPropagation();
    },
  });
}

type HandleLoadingOptions = {
  loadedSrcRef: RefObject<string | null>;
  srcKey: string;
  setLoadedSrc: Dispatch<SetStateAction<string | null>>;
  onLoad: ImgHTMLAttributes<HTMLImageElement>["onLoad"];
};

/**
 * Next.js waits for decode before clearing the placeholder and replays this
 * for an image that completed before hydration attached its load handler.
 * @see https://github.com/vercel/next.js/blob/78b11c37e6eafb92030612c08de4adb5bb5c8a28/packages/next/src/client/image-component.tsx
 */
function handleLoading(img: HTMLImageElement, options: HandleLoadingOptions) {
  if (options.loadedSrcRef.current === img.src) return;
  options.loadedSrcRef.current = img.src;

  const decode = "decode" in img ? img.decode() : Promise.resolve();
  void decode
    .catch(() => {})
    .then(() => {
      if (!img.parentElement || !img.isConnected) return;
      options.setLoadedSrc(options.srcKey);
      callOnLoad(img, options.onLoad);
    });
}

const useNonWarningLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Drop-in `<img>` implementing Next.js' `blurDataURL` lifecycle. SSR keeps the
 * real `src` on the accessible image so loading starts immediately, while a
 * separate foreground layer prevents progressive JPEG scans from painting
 * over the placeholder before the full image has decoded.
 */
export function BlurImage(props: BlurImageProps) {
  const srcKey = imageSrcKey(props.src);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === srcKey;
  const showAltText = failedSrc === srcKey;

  useNonWarningLayoutEffect(() => {
    const img = imgRef.current;
    if (!img?.complete) return;
    handleLoading(img, {
      loadedSrcRef,
      srcKey,
      setLoadedSrc,
      onLoad: props.onLoad,
    });
  }, [props.onLoad, srcKey]);

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
      onLoad={(event) => {
        handleLoading(event.currentTarget, {
          loadedSrcRef,
          srcKey,
          setLoadedSrc,
          onLoad: props.onLoad,
        });
      }}
      onError={(event) => {
        setFailedSrc(srcKey);
        setLoadedSrc(srcKey);
        props.onError?.(event);
      }}
      src={props.src}
    />
  );

  if (!props.blurDataUrl) return image;

  return (
    <span
      className={props.className}
      data-blur-image-wrapper=""
      style={{ display: "inline-grid", position: "relative" }}
    >
      {image}
      {placeholderSrc ? (
        <img
          aria-hidden="true"
          alt=""
          className={props.className}
          data-blur-image-placeholder=""
          src={placeholderSrc}
          style={{
            borderRadius: "inherit",
            height: "100%",
            inset: 0,
            objectFit,
            objectPosition: props.style?.objectPosition ?? "50% 50%",
            pointerEvents: "none",
            position: "absolute",
            width: "100%",
          }}
        />
      ) : null}
    </span>
  );
}
