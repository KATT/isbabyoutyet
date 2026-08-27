import { useEffect, useState } from "react";

/**
 * Creates an object URL for a Blob/File and revokes it when the blob changes
 * or the consumer unmounts. Lives under `apps/web/src/lib` so feature
 * components stay free of synchronization effects.
 */
export function useObjectUrl(blob: Blob | null) {
  const [cached, setCached] = useState<{ blob: Blob | null; url: string | null }>({
    blob: null,
    url: null,
  });

  let url = cached.url;
  if (cached.blob !== blob) {
    if (cached.url) {
      URL.revokeObjectURL(cached.url);
    }
    url = blob ? URL.createObjectURL(blob) : null;
    setCached({ blob, url });
  }

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}
