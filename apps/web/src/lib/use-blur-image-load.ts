import { useRef, useState } from "react";
import type { Dispatch, ImgHTMLAttributes, RefObject, SetStateAction, SyntheticEvent } from "react";
import { useCompleteImageLoad } from "@/lib/use-complete-image-load";

type HandleLoadingOptions = {
  loadedSrcRef: RefObject<string | null>;
  srcKey: string;
  setLoadedSrc: Dispatch<SetStateAction<string | null>>;
  onLoad: ImgHTMLAttributes<HTMLImageElement>["onLoad"];
};

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

/**
 * Owns BlurImage load/fail tracking. Lives in lib so feature UI stays free of
 * useState (audited seam under no-use-state).
 */
export function useBlurImageLoad(opts: {
  srcKey: string;
  onLoad: ImgHTMLAttributes<HTMLImageElement>["onLoad"];
  onError: ImgHTMLAttributes<HTMLImageElement>["onError"];
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === opts.srcKey;
  const showAltText = failedSrc === opts.srcKey;

  useCompleteImageLoad({
    imgRef,
    srcKey: opts.srcKey,
    onComplete: (img) => {
      handleLoading(img, {
        loadedSrcRef,
        srcKey: opts.srcKey,
        setLoadedSrc,
        onLoad: opts.onLoad,
      });
    },
  });

  function onLoad(event: SyntheticEvent<HTMLImageElement>) {
    handleLoading(event.currentTarget, {
      loadedSrcRef,
      srcKey: opts.srcKey,
      setLoadedSrc,
      onLoad: opts.onLoad,
    });
  }

  function onError(event: SyntheticEvent<HTMLImageElement>) {
    setFailedSrc(opts.srcKey);
    setLoadedSrc(opts.srcKey);
    opts.onError?.(event);
  }

  return {
    imgRef,
    loaded,
    showAltText,
    onLoad,
    onError,
  };
}
