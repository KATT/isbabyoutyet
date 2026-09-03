import { PhotoLightbox } from "@/components/baby/photo-lightbox";
import { browserImageFactory, prefetchBrowserImage } from "@/lib/image-prefetch";
import { useI18n } from "@/lib/i18n";
import { useBabyPhotoOverlayNav } from "@/lib/overlay-nav";
import { api } from "@workspace/convex/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { preloadedQueryOptions } from "@workspace/query-prefetch";

export const Route = createFileRoute("/baby/$publicId/photo")({
  loader: async (opts) => {
    const baby = await opts.context.convexPreloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc?.photoUrl) {
      throw notFound();
    }
    const imagePrefetch = prefetchBrowserImage(opts.context.queryClient, babyDoc.photoUrl);
    // oxlint-disable-next-line workspace/use-loader-preloads -- Snapshot must stay stable while the lightbox is open.
    return {
      baby,
      imagePrefetch,
    };
  },
  component: BabyPhotoOverlay,
});

export function BabyPhotoOverlay() {
  const { t } = useI18n();
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  const photo = useBabyPhotoOverlayNav(params.publicId);
  useQuery(preloadedQueryOptions(browserImageFactory, loaderData.imagePrefetch));
  const babyDoc = loaderData.baby.initialData;
  if (!babyDoc?.photoUrl) {
    throw notFound();
  }

  return (
    <PhotoLightbox
      alt={t("Photo of {{name}}", { name: babyDoc.name })}
      blurDataUrl={babyDoc.blurDataUrl ?? null}
      overlay={photo}
      photoUrl={babyDoc.photoUrl}
    />
  );
}
