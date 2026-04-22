const ENCOURAGEMENT_IMAGE_SCHEME = "encouragement-image:";

function escapeAltText(altText: string) {
  return altText.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

export function createMarkdownImage(opts: {
  url: string;
  altText: string;
}) {
  return `![${escapeAltText(opts.altText)}](${opts.url})`;
}

export function createEncouragementImageMarkdown(opts: {
  storageId: string;
  altText: string;
}) {
  return createMarkdownImage({
    url: `${ENCOURAGEMENT_IMAGE_SCHEME}${opts.storageId}`,
    altText: opts.altText,
  });
}

export function extractEncouragementImageIds(markdown: string) {
  const matches = markdown.matchAll(/encouragement-image:([^)]+)\)/g);
  const imageIds = new Set<string>();

  for (const match of matches) {
    const imageId = match[1]?.trim();
    if (imageId) {
      imageIds.add(imageId);
    }
  }

  return [...imageIds];
}

export function resolveEncouragementImageMarkdown(opts: {
  markdown: string;
  imageUrls: Record<string, string | null | undefined>;
}) {
  return opts.markdown.replaceAll(/encouragement-image:([^)]+)\)/g, (match, rawImageId) => {
    const imageId = typeof rawImageId === "string" ? rawImageId.trim() : "";
    const imageUrl = opts.imageUrls[imageId];
    if (!imageUrl) {
      return match;
    }

    return `${imageUrl})`;
  });
}

export function replaceEncouragementImageUrlsWithTokens(opts: {
  markdown: string;
  imageIdsByUrl: Record<string, string>;
}) {
  let nextMarkdown = opts.markdown;

  for (const [imageUrl, imageId] of Object.entries(opts.imageIdsByUrl)) {
    nextMarkdown = nextMarkdown.replaceAll(imageUrl, `${ENCOURAGEMENT_IMAGE_SCHEME}${imageId}`);
  }

  return nextMarkdown;
}
