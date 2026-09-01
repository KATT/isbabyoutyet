import { SettingsPanel } from "@/components/baby/settings-panel";
import { prefetchBrowserPushCapability } from "@/components/baby/notification-subscribe";
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
    if (globalThis.window === undefined && !token) {
      throw redirect({
        params: { publicId: opts.params.publicId },
        resetScroll: false,
        to: "/baby/$publicId",
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
        params: { publicId: babyDoc.publicId },
        replace: true,
        to: "/baby/$publicId/settings",
      });
    }
    return token ? { isAuthenticated: true, token } : undefined;
  },
  component: BabySettingsOverlay,
  loader: async (opts) => {
    const babyRef = opts.params.publicId;
    const browserPush = prefetchBrowserPushCapability(opts.context.queryClient, babyRef);
    const data = await allKeyed({
      coParentsList: opts.context.convexPreloader.ensureQueryData(api.coParents.listForBaby, {
        babyId: babyRef,
      }),
      managerBaby: opts.context.convexPreloader.ensureQueryData(api.baby.getManagerBaby, {
        babyId: babyRef,
      }),
      myAccess: opts.context.convexPreloader.ensureQueryData(api.coParents.myAccess, {
        babyId: babyRef,
      }),
      profile: opts.context.convexPreloader.ensureQueryData(api.profile.get, {}),
      vapidPublicKey: opts.context.convexPreloader.ensureQueryData(
        api.pushSubscriptions.getPublicKey,
        {},
      ),
    });
    if (!data.myAccess.initialData.canManage || data.managerBaby.initialData === FORBIDDEN) {
      throw redirect({
        params: { publicId: babyRef },
        resetScroll: false,
        to: "/baby/$publicId",
      });
    }
    // oxlint-disable-next-line workspace/use-loader-preloads -- The authorized snapshot must remain stable while client auth reconnects.
    return { ...data, browserPush };
  },
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
      coParents={{
        babyId: managerBabyDoc._id,
        isOwner,
        listing: loaderData.coParentsList,
      }}
      messagePush={{
        babyId: managerBabyDoc._id,
        browserPush: loaderData.browserPush,
        vapidPublicKey: loaderData.vapidPublicKey,
      }}
      onDelete={
        isOwner
          ? async () => {
              await removeBaby({ babyId: managerBabyDoc._id });
              void navigate({ to: "/dashboard" });
            }
          : null
      }
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
      onOpenChange={settings.onOpenChange}
      onOpenChangeComplete={settings.onOpenChangeComplete}
      onUpdate={async (update) => {
        await updateBaby({ id: managerBabyDoc._id, patch: update });
        await router.invalidate();
      }}
      open={settings.open}
      profileLocale={loaderData.profile.initialData?.locale ?? locale}
    />
  );
}
