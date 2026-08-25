import { PhotoLightbox } from "@/components/baby/photo-lightbox";
import { browserImageFactory, prefetchBrowserImage } from "@/lib/image-prefetch";
import { useI18n } from "@/lib/i18n";
import { useBabyPhotoOverlayNav } from "@/lib/overlay-nav";
import { api } from "@workspace/convex/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { preloadedQueryOptions } from "@workspace/query-prefetch";

export const Route = createFileRoute("/baby/$publicId/photo")({
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
        to: "/baby/$publicId/photo",
        params: { publicId: babyDoc.publicId },
        replace: true,
      });
    }
  },
  loader: async (opts) => {
    const baby = await opts.context.convexPreloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc?.photoUrl) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: opts.params.publicId },
        resetScroll: false,
      });
    }
    const imagePrefetch = prefetchBrowserImage(opts.context.queryClient, babyDoc.photoUrl);
    // oxlint-disable-next-line query-prefetch/use-loader-preloads -- Snapshot must stay stable while the lightbox is open.
    return {
      baby,
      imagePrefetch,
    };
  },
  component: BabyPhotoOverlay,
});

export type BabyPhotoOverlayViewProps = {
  publicId: string;
  photoUrl: string;
  blurDataUrl: string | null;
  alt: string;
};

/** Presentational page-photo lightbox; overlay-nav is the only router dependency. */
export function BabyPhotoOverlayView(props: BabyPhotoOverlayViewProps) {
  const photo = useBabyPhotoOverlayNav(props.publicId);

  return (
    <PhotoLightbox
      photoUrl={props.photoUrl}
      blurDataUrl={props.blurDataUrl}
      alt={props.alt}
      overlay={photo}
    />
  );
}

export function BabyPhotoOverlay() {
  const { t } = useI18n();
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  useQuery(preloadedQueryOptions(browserImageFactory, loaderData.imagePrefetch));
  const babyDoc = loaderData.baby.initialData;
  if (!babyDoc?.photoUrl) {
    throw notFound();
  }

  return (
    <BabyPhotoOverlayView
      publicId={params.publicId}
      photoUrl={babyDoc.photoUrl}
      blurDataUrl={babyDoc.blurDataUrl ?? null}
      alt={t("Photo of {{name}}", { name: babyDoc.name })}
    />
  );
}
