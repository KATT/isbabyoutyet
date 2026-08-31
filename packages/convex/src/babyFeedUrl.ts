export const BABY_FEED_HASH = "feed";

export function babyFeedUrl(publicId: string) {
  return `/baby/${publicId}#${BABY_FEED_HASH}`;
}
