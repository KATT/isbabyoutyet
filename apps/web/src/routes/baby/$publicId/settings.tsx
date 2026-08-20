import { SettingsPanel } from "@/components/baby/settings-panel";
import { FORBIDDEN } from "@workspace/convex/src/types";
import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { getConvexQueryPreloader, usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { useMutation } from "convex/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { managerDocToBabyData } from "./shared";
import { Route as BabyPageRoute } from "./route";

export const Route = createFileRoute("/baby/$publicId/settings")({
  beforeLoad: async (opts) => {
    const preloader = getConvexQueryPreloader(opts.context.queryClient);
    const baby = await preloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc) {
      throw notFound();
    }

    const myAccess = await preloader.ensureQueryData(api.coParents.myAccess, {
      babyId: babyDoc._id,
    });
    const access = myAccess.initialData;
    if (!access.canManage) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: babyDoc.publicId },
        replace: true,
        resetScroll: false,
      });
    }

    const managerBaby = await preloader.ensureQueryData(api.baby.getManagerBaby, {
      babyId: babyDoc._id,
    });
    if (managerBaby.initialData === FORBIDDEN || !managerBaby.initialData?.birthJourney) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: babyDoc.publicId },
        replace: true,
        resetScroll: false,
      });
    }
  },
  loader: async (opts) => {
    const preloader = getConvexQueryPreloader(opts.context.queryClient);
    const baby = await preloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc) {
      throw notFound();
    }

    return {
      profile: await preloader.ensureQueryData(api.profile.get, {}),
      coParentsList: await preloader.ensureQueryData(api.coParents.listForBaby, {
        babyId: babyDoc._id,
      }),
    };
  },
  component: BabySettingsPage,
});

function BabySettingsPage() {
  const { locale } = useI18n();
  const params = Route.useParams();
  const navigate = useNavigate({ from: "/baby/$publicId/settings" });
  const router = useRouter();
  const parentLoader = BabyPageRoute.useLoaderData();
  const loaderData = Route.useLoaderData();
  if (!parentLoader || !loaderData) {
    throw notFound();
  }

  const babyQuery = usePreloadedConvexQuery(api.baby.getByPublicId, parentLoader.baby);
  const babyDoc = babyQuery.data;
  if (!babyDoc) {
    throw notFound();
  }

  const profileQuery = usePreloadedConvexQuery(api.profile.get, loaderData.profile);
  const managerBabyQuery = usePreloadedConvexQuery(
    api.baby.getManagerBaby,
    parentLoader.managerBaby,
  );
  const myAccessQuery = usePreloadedConvexQuery(api.coParents.myAccess, parentLoader.myAccess);

  const updateBaby = useMutation(api.baby.update);
  const removeBaby = useMutation(api.baby.remove);
  const redateMilestone = useMutation(api.updates.redateMilestone);
  const unmarkMilestone = useMutation(api.updates.unmarkMilestone);

  const profile = profileQuery.data;
  const myAccess = myAccessQuery.data;
  const isOwner = myAccess.isOwner;
  const managerBabyDoc = managerBabyQuery.data === FORBIDDEN ? null : managerBabyQuery.data;
  if (!managerBabyDoc?.birthJourney) {
    throw notFound();
  }
  const managerBaby = managerDocToBabyData(managerBabyDoc);

  return (
    <SettingsPanel
      baby={managerBaby}
      birthJourney={managerBabyDoc.birthJourney}
      profileLocale={profile?.locale ?? locale}
      onUpdate={async (update) => {
        await updateBaby({
          babyId: babyDoc._id,
          ...update,
        });
        await router.invalidate();
      }}
      onMilestoneRedate={async (milestone, occurredAt) => {
        await redateMilestone({
          babyId: babyDoc._id,
          milestone,
          occurredAt: Date.parse(occurredAt),
        });
        await router.invalidate();
      }}
      onMilestoneRemove={async (milestone) => {
        await unmarkMilestone({ babyId: babyDoc._id, milestone });
        await router.invalidate();
      }}
      onDelete={
        isOwner
          ? async () => {
              await removeBaby({ babyId: babyDoc._id });
              void navigate({ to: "/dashboard" });
            }
          : null
      }
      coParents={{
        babyId: babyDoc._id,
        isOwner,
        listing: loaderData.coParentsList,
      }}
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          void navigate({
            to: "/baby/$publicId",
            params: { publicId: params.publicId },
            replace: true,
            resetScroll: false,
          });
        }
      }}
    />
  );
}
