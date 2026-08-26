import { useEffect, useState } from "react";

/**
 * Creates an object URL for a Blob/File and revokes it when the blob changes
 * or the consumer unmounts. Create/revoke run in an effect (not during render)
 * so discarded renders cannot leak URLs or revoke a committed URL mid-paint.
 */
export function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [blob]);

  return url;
}
