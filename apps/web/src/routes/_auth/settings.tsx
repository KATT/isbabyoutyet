import { SettingsPanel } from "@/components/baby/settings-panel";
import { getThemeCss } from "@/components/baby/utils";
import { allKeyed } from "@workspace/query-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { FORBIDDEN } from "@workspace/convex/src/types";
import type { BabyData } from "@workspace/convex/src/types";
import {
  createFileRoute,
  getRouteApi,
  Link,
  notFound,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { useMutation } from "convex/react";
import { z } from "zod";

export const Route = createFileRoute("/_auth/settings")({
  validateSearch: z.object({
    baby: z.string().optional(),
  }),
  beforeLoad: async (opts) => {
    const babyRef = opts.search.baby;
    if (!babyRef) {
      throw redirect({ to: "/dashboard" });
    }
    const baby = await opts.context.convexPreloader.ensureQueryData(api.baby.getByPublicId, {
      id: babyRef,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc) {
      throw notFound();
    }
    if (babyDoc.publicId !== babyRef) {
      throw redirect({
        to: "/settings",
        search: { baby: babyDoc.publicId },
        replace: true,
      });
    }
    return { locale: babyDoc.resolvedLocale };
  },
  loaderDeps: (opts) => ({ baby: opts.search.baby }),
  loader: async (opts) => {
    const babyRef = opts.deps.baby;
    if (!babyRef) {
      throw redirect({ to: "/dashboard" });
    }
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
    });
    if (!data.myAccess.initialData.canManage || data.managerBaby.initialData === FORBIDDEN) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: babyRef },
      });
    }
    // oxlint-disable-next-line query-prefetch/use-loader-preloads -- The authorized snapshot must remain stable while client auth reconnects.
    return data;
  },
  head: (opts) => {
    const managerBaby = opts.loaderData?.managerBaby.initialData;
    if (!managerBaby || managerBaby === FORBIDDEN) {
      return {};
    }
    return {
      meta: [{ title: `Settings – ${managerBaby.name}` }],
      styles: [{ children: getThemeCss(managerBaby.theme) }],
    };
  },
  component: SettingsPage,
});

type ManagerBabyDoc = Exclude<FunctionReturnType<typeof api.baby.getManagerBaby>, typeof FORBIDDEN>;

function managerDocToBabyData(doc: ManagerBabyDoc): BabyData {
  return {
    name: doc.name,
    dueDate: doc.dueDate,
    dueDateDisplayMode: doc.dueDateDisplayMode,
    publicDueDateText: doc.publicDueDateText,
    theme: doc.theme ?? null,
    locale: doc.locale ?? null,
    laborStarted: doc.laborStarted ?? null,
    wentToHospital: doc.wentToHospital ?? null,
    babyBorn: doc.babyBorn ?? null,
    milestoneVisibility: doc.milestoneVisibility,
    photoId: doc.photoId ?? null,
  };
}

function SettingsPage() {
  const authRoute = getRouteApi("/_auth");
  const authContext = authRoute.useRouteContext();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const search = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const updateBaby = useMutation(api.baby.update);
  const removeBaby = useMutation(api.baby.remove);
  const redateMilestone = useMutation(api.updates.redateMilestone);
  const unmarkMilestone = useMutation(api.updates.unmarkMilestone);
  const managerBabyDoc =
    loaderData.managerBaby.initialData === FORBIDDEN ? null : loaderData.managerBaby.initialData;
  if (!managerBabyDoc || !search.baby) {
    throw notFound();
  }
  const babyRef = search.baby;
  const baby = managerDocToBabyData(managerBabyDoc);
  const isOwner = loaderData.myAccess.initialData.isOwner;

  return (
    <main className="min-h-screen bg-background bg-dots px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Link
          to="/baby/$publicId"
          params={{ publicId: babyRef }}
          className="font-bold text-muted-foreground hover:text-foreground"
        >
          ← {baby.name}
        </Link>
      </div>
      <SettingsPanel
        baby={baby}
        birthJourney={managerBabyDoc.birthJourney}
        profileLocale={authContext.profile.initialData?.locale ?? "en-GB"}
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
        open
        onOpenChange={(open) => {
          if (!open) {
            void navigate({
              to: "/baby/$publicId",
              params: { publicId: babyRef },
            });
          }
        }}
      />
    </main>
  );
}
