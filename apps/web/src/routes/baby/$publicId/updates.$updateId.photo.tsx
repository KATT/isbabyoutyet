import { PhotoLightbox } from "@/components/baby/photo-lightbox";
import { browserImageFactory, prefetchBrowserImage } from "@/lib/image-prefetch";
import { useI18n } from "@/lib/i18n";
import { useBabyUpdatePhotoOverlayNav } from "@/lib/overlay-nav";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { preloadedQueryOptions } from "@workspace/query-prefetch";

export const Route = createFileRoute("/baby/$publicId/updates/$updateId/photo")({
  beforeLoad: async (opts) => {
    const baby = await opts.context.convexPreloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc) {
      throw notFound();
    }
    if (babyDoc.publicId !== opts.params.publicId) {
      throw redirect({
        to: "/baby/$publicId/updates/$updateId/photo",
        params: { publicId: babyDoc.publicId, updateId: opts.params.updateId },
        replace: true,
      });
    }
  },
  loader: async (opts) => {
    const updatePhoto = await opts.context.convexPreloader.ensureQueryData(
      api.timeline.getUpdatePhoto,
      {
        babyId: opts.params.publicId,
        updateId: opts.params.updateId as Id<"updates">,
      },
    );
    if (!updatePhoto.initialData) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: opts.params.publicId },
        resetScroll: false,
      });
    }
    const imagePrefetch = prefetchBrowserImage(
      opts.context.queryClient,
      updatePhoto.initialData.photoUrl,
    );
    // oxlint-disable-next-line query-prefetch/use-loader-preloads -- Snapshot must stay stable while the lightbox is open.
    return {
      updatePhoto,
      imagePrefetch,
    };
  },
  component: BabyUpdatePhotoOverlay,
});

export function BabyUpdatePhotoOverlay() {
  const { t } = useI18n();
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  useQuery(preloadedQueryOptions(browserImageFactory, loaderData.imagePrefetch));
  const updatePhoto = loaderData.updatePhoto.initialData;
  if (!updatePhoto) {
    throw notFound();
  }
  const photo = useBabyUpdatePhotoOverlayNav({
    publicId: params.publicId,
    updateId: params.updateId,
  });

  return (
    <PhotoLightbox
      photoUrl={updatePhoto.photoUrl}
      blurDataUrl={updatePhoto.blurDataUrl}
      alt={t("Photo of {{name}}", { name: updatePhoto.babyName })}
      overlay={photo}
    />
  );
}
