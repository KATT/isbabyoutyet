import { SettingsPanel } from "@/components/baby/settings-panel";
import { allKeyed } from "@workspace/query-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { FORBIDDEN } from "@workspace/convex/src/types";
import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useI18n } from "@/lib/i18n";
import { authenticateManagerOverlaySsr } from "@/lib/managerOverlayAuth";
import { useBabySettingsOverlayNav } from "@/lib/overlay-nav";
import { managerDocToBabyData } from "@/routes/baby/$publicId/route";

export const Route = createFileRoute("/baby/$publicId/settings")({
  beforeLoad: async (opts) => {
    const token = await authenticateManagerOverlaySsr(opts.context);
    if (typeof window === "undefined" && !token) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: opts.params.publicId },
        resetScroll: false,
      });
    }

    const baby = await opts.context.convexPreloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc) {
      throw notFound();
    }
    if (babyDoc.publicId !== opts.params.publicId) {
      throw redirect({
        to: "/baby/$publicId/settings",
        params: { publicId: babyDoc.publicId },
        replace: true,
      });
    }
    return token ? { token, isAuthenticated: true } : undefined;
  },
  loader: async (opts) => {
    const babyRef = opts.params.publicId;
    const data = await allKeyed({
      managerBaby: opts.context.convexPreloader.ensureQueryData(api.baby.getManagerBaby, {
        babyId: babyRef,
      }),
      myAccess: opts.context.convexPreloader.ensureQueryData(api.coParents.myAccess, {
        babyId: babyRef,
      }),
      coParentsList: opts.context.convexPreloader.ensureQueryData(api.coParents.listForBaby, {
        babyId: babyRef,
      }),
      profile: opts.context.convexPreloader.ensureQueryData(api.profile.get, {}),
    });
    if (!data.myAccess.initialData.canManage || data.managerBaby.initialData === FORBIDDEN) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: babyRef },
        resetScroll: false,
      });
    }
    // oxlint-disable-next-line query-prefetch/use-loader-preloads -- The authorized snapshot must remain stable while client auth reconnects.
    return data;
  },
  component: BabySettingsOverlay,
});

export function BabySettingsOverlay() {
  const { locale } = useI18n();
  const params = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const loaderData = Route.useLoaderData();
  const settings = useBabySettingsOverlayNav(params.publicId);
  const updateBaby = useMutation(api.baby.update);
  const removeBaby = useMutation(api.baby.remove);
  const redateMilestone = useMutation(api.updates.redateMilestone);
  const unmarkMilestone = useMutation(api.updates.unmarkMilestone);
  const managerBabyDoc =
    loaderData.managerBaby.initialData === FORBIDDEN ? null : loaderData.managerBaby.initialData;
  if (!managerBabyDoc) {
    throw notFound();
  }
  const isOwner = loaderData.myAccess.initialData.isOwner;
  const baby = managerDocToBabyData(managerBabyDoc);

  return (
    <SettingsPanel
      baby={baby}
      birthJourney={managerBabyDoc.birthJourney}
      profileLocale={loaderData.profile.initialData?.locale ?? locale}
      onUpdate={async (update) => {
        await updateBaby({ babyId: managerBabyDoc._id, ...update });
        await router.invalidate();
      }}
      onMilestoneRedate={async (milestone, occurredAt) => {
        await redateMilestone({
          babyId: managerBabyDoc._id,
          milestone,
          occurredAt: Date.parse(occurredAt),
        });
        await router.invalidate();
      }}
      onMilestoneRemove={async (milestone) => {
        await unmarkMilestone({ babyId: managerBabyDoc._id, milestone });
        await router.invalidate();
      }}
      onDelete={
        isOwner
          ? async () => {
              await removeBaby({ babyId: managerBabyDoc._id });
              void navigate({ to: "/dashboard" });
            }
          : null
      }
      coParents={{
        babyId: managerBabyDoc._id,
        isOwner,
        listing: loaderData.coParentsList,
      }}
      open={settings.open}
      onOpenChange={settings.onOpenChange}
      onOpenChangeComplete={settings.onOpenChangeComplete}
    />
  );
}
