import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, Dispatch, ImgHTMLAttributes, RefObject, SetStateAction } from "react";

type BlurImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
  blurDataUrl: string | null;
};

type BlurImageDebugEntry = {
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
};

function recordBlurImageDebug(entry: BlurImageDebugEntry) {
  if (typeof window === "undefined") return;
  void fetch("/api/debug/blur-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entry),
    keepalive: true,
  }).catch(() => {});
}

function imageOrigin(src: string) {
  if (!src) return null;
  if (src.startsWith("data:")) return "data:";
  try {
    return new URL(src, window.location.href).origin;
  } catch {
    return "invalid";
  }
}

function imageElementDebugData(img: HTMLImageElement) {
  const computed = window.getComputedStyle(img);
  const resource = performance.getEntriesByName(img.currentSrc).at(-1);
  return {
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    currentSrcOrigin: imageOrigin(img.currentSrc),
    inlineBackgroundPresent: img.style.backgroundImage.includes("data:image/svg+xml"),
    inlineBackgroundLength: img.style.backgroundImage.length,
    computedBackgroundPresent: computed.backgroundImage.includes("data:image/svg+xml"),
    computedBackgroundLength: computed.backgroundImage.length,
    display: computed.display,
    visibility: computed.visibility,
    opacity: computed.opacity,
    renderedWidth: img.getBoundingClientRect().width,
    renderedHeight: img.getBoundingClientRect().height,
    resourceResponseEnd: resource?.entryType === "resource" ? resource.startTime + resource.duration : null,
    isConnected: img.isConnected,
  };
}

function imageSrcKey(src: BlurImageProps["src"]) {
  return typeof src === "string" ? src : "";
}

function numericDimension(value: BlurImageProps["width"] | BlurImageProps["height"]) {
  if (typeof value === "number") return value;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  debugId: string;
  debugStartedAt: number;
};

/**
 * Next.js waits for decode before clearing the placeholder and replays this
 * for an image that completed before hydration attached its load handler.
 * @see https://github.com/vercel/next.js/blob/78b11c37e6eafb92030612c08de4adb5bb5c8a28/packages/next/src/client/image-component.tsx
 */
function handleLoading(img: HTMLImageElement, options: HandleLoadingOptions) {
  // #region agent log
  recordBlurImageDebug({
    hypothesisId: "D",
    location: "blur-image.tsx:handleLoading-entry",
    message: "load handling entered",
    data: {
      debugId: options.debugId,
      elapsedMs: Date.now() - options.debugStartedAt,
      duplicateForSrc: options.loadedSrcRef.current === img.src,
      ...imageElementDebugData(img),
    },
    timestamp: Date.now(),
  });
  // #endregion
  if (options.loadedSrcRef.current === img.src) return;
  options.loadedSrcRef.current = img.src;

  const decode = "decode" in img ? img.decode() : Promise.resolve();
  void decode
    .then(
      () => "resolved",
      () => "rejected",
    )
    .then((decodeOutcome) => {
      // #region agent log
      recordBlurImageDebug({
        hypothesisId: "B,D",
        location: "blur-image.tsx:decode-settled",
        message: "full image decode settled before placeholder clear",
        data: {
          debugId: options.debugId,
          elapsedMs: Date.now() - options.debugStartedAt,
          decodeOutcome,
          ...imageElementDebugData(img),
        },
        timestamp: Date.now(),
      });
      // #endregion
      if (!img.parentElement || !img.isConnected) return;
      options.setLoadedSrc(options.srcKey);
      callOnLoad(img, options.onLoad);
    });
}

const useNonWarningLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Drop-in `<img>` implementing Next.js' `blurDataURL` mechanics. SSR puts both
 * the real `src` and a blurred SVG background on the same element. The request
 * starts immediately; decoded replaced-image pixels naturally paint over the
 * background without waiting for hydration. TanStack Start/Router has no Image
 * component of its own.
 */
export function BlurImage(props: BlurImageProps) {
  const srcKey = imageSrcKey(props.src);
  const debugId = useId();
  const debugStartedAt = useRef(Date.now());
  const imgRef = useRef<HTMLImageElement | null>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === srcKey;
  const showAltText = failedSrc === srcKey;

  useNonWarningLayoutEffect(() => {
    const img = imgRef.current;
    // #region agent log
    recordBlurImageDebug({
      hypothesisId: "D",
      location: "blur-image.tsx:layout-effect",
      message: "hydration completion check",
      data: {
        debugId,
        elapsedMs: Date.now() - debugStartedAt.current,
        hasElement: !!img,
        ...(img ? imageElementDebugData(img) : {}),
      },
      timestamp: Date.now(),
    });
    // #endregion
    if (!img?.complete) return;
    handleLoading(img, {
      loadedSrcRef,
      srcKey,
      setLoadedSrc,
      onLoad: props.onLoad,
      debugId,
      debugStartedAt: debugStartedAt.current,
    });
  }, [debugId, props.onLoad, srcKey]);

  const objectFit = props.style?.objectFit;
  const blurSvgUrl =
    props.blurDataUrl && !loaded
      ? `data:image/svg+xml;charset=utf-8,${getImageBlurSvg({
          width: numericDimension(props.width),
          height: numericDimension(props.height),
          blurDataUrl: props.blurDataUrl,
          objectFit,
        })}`
      : null;
  const backgroundImage = blurSvgUrl ? `url("${blurSvgUrl}")` : undefined;
  const backgroundSize =
    objectFit === "fill" ? "100% 100%" : objectFit === "contain" ? "contain" : "cover";
  const placeholderStyle = backgroundImage
    ? {
        backgroundSize,
        backgroundPosition: props.style?.objectPosition ?? "50% 50%",
        backgroundRepeat: "no-repeat",
        backgroundImage,
      }
    : {};

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    // #region agent log
    recordBlurImageDebug({
      hypothesisId: "A,B",
      location: "blur-image.tsx:committed",
      message: "blur image committed with runtime styles",
      data: {
        debugId,
        elapsedMs: Date.now() - debugStartedAt.current,
        blurDataUrlPresent: !!props.blurDataUrl,
        blurDataUrlLength: props.blurDataUrl?.length ?? 0,
        blurDataUrlMimePrefix: props.blurDataUrl?.slice(0, 23) ?? null,
        srcOrigin: imageOrigin(srcKey),
        ...imageElementDebugData(img),
      },
      timestamp: Date.now(),
    });
    // #endregion
  }, [debugId, props.blurDataUrl, srcKey]);

  useEffect(() => {
    if (!blurSvgUrl) return;
    const probe = new Image();
    const finishProbe = (outcome: "load" | "error") => {
      // #region agent log
      recordBlurImageDebug({
        hypothesisId: "C",
        location: "blur-image.tsx:svg-probe",
        message: "standalone SVG placeholder probe finished",
        data: {
          debugId,
          elapsedMs: Date.now() - debugStartedAt.current,
          outcome,
          naturalWidth: probe.naturalWidth,
          naturalHeight: probe.naturalHeight,
        },
        timestamp: Date.now(),
      });
      // #endregion
    };
    probe.onload = () => finishProbe("load");
    probe.onerror = () => finishProbe("error");
    probe.src = blurSvgUrl;
    return () => {
      probe.onload = null;
      probe.onerror = null;
    };
  }, [blurSvgUrl, debugId]);

  useEffect(() => {
    if (!loaded) return;
    const img = imgRef.current;
    if (!img) return;
    // #region agent log
    recordBlurImageDebug({
      hypothesisId: "D",
      location: "blur-image.tsx:placeholder-cleared",
      message: "loaded state committed after placeholder clear",
      data: {
        debugId,
        elapsedMs: Date.now() - debugStartedAt.current,
        ...imageElementDebugData(img),
      },
      timestamp: Date.now(),
    });
    // #endregion
  }, [debugId, loaded]);

  return (
    <img
      {...imgPropsWithoutBlur(props)}
      ref={imgRef}
      alt={props.alt}
      decoding={props.decoding ?? "async"}
      style={{
        color: showAltText ? undefined : "transparent",
        ...props.style,
        ...placeholderStyle,
      }}
      onLoad={(event) => {
        handleLoading(event.currentTarget, {
          loadedSrcRef,
          srcKey,
          setLoadedSrc,
          onLoad: props.onLoad,
          debugId,
          debugStartedAt: debugStartedAt.current,
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
}
