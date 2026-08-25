import { SettingsPanel } from "@/components/baby/settings-panel";
import { allKeyed } from "@workspace/query-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { FORBIDDEN } from "@workspace/convex/src/types";
import type { BabyData, BabyUpdate, Milestone } from "@workspace/convex/src/types";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { useMutation } from "convex/react";
import type { ComponentProps, ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { authenticateManagerOverlaySsr } from "@/lib/managerOverlayAuth";
import { useBabySettingsOverlayNav } from "@/lib/overlay-nav";

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

type ManagerBabyDoc = Exclude<FunctionReturnType<typeof api.baby.getManagerBaby>, typeof FORBIDDEN>;

export function managerDocToBabyData(doc: ManagerBabyDoc): BabyData {
  return {
    name: doc.name,
    dueDate: doc.dueDate,
    dueDateDisplayMode: doc.dueDateDisplayMode,
    publicDueDateText: doc.publicDueDateText,
    theme: doc.theme ?? null,
    locale: doc.locale ?? null,
    timeZone: doc.timeZone,
    laborStarted: doc.laborStarted ?? null,
    wentToHospital: doc.wentToHospital ?? null,
    babyBorn: doc.babyBorn ?? null,
    milestoneVisibility: doc.milestoneVisibility,
    photoId: doc.photoId ?? null,
  };
}

type SettingsPanelProps = ComponentProps<typeof SettingsPanel>;

export type BabySettingsOverlayDeps = {
  updateBaby: (args: { babyId: Id<"baby"> } & BabyUpdate) => Promise<unknown>;
  removeBaby: (args: { babyId: Id<"baby"> }) => Promise<unknown>;
  redateMilestone: (args: {
    babyId: Id<"baby">;
    milestone: Milestone;
    occurredAt: number;
  }) => Promise<unknown>;
  unmarkMilestone: (args: { babyId: Id<"baby">; milestone: Milestone }) => Promise<unknown>;
  invalidate: () => Promise<void>;
  navigateToDashboard: () => void;
};

export type BabySettingsOverlayViewProps = {
  publicId: string;
  managerBabyDoc: ManagerBabyDoc;
  isOwner: boolean;
  profileLocale: SupportedLocale;
  coParentsList: NonNullable<SettingsPanelProps["coParents"]>["listing"];
  deps: BabySettingsOverlayDeps;
  /** Injected so tests can stub SettingsPanel without `vi.mock`. */
  renderSettingsPanel: (props: SettingsPanelProps) => ReactNode;
};

/**
 * Presentational settings overlay. Mutations / router invalidate / panel markup
 * are injected so route tests stay mock-free.
 */
export function BabySettingsOverlayView(props: BabySettingsOverlayViewProps) {
  const settings = useBabySettingsOverlayNav(props.publicId);
  const baby = managerDocToBabyData(props.managerBabyDoc);
  const deps = props.deps;

  return props.renderSettingsPanel({
    baby,
    birthJourney: props.managerBabyDoc.birthJourney,
    profileLocale: props.profileLocale,
    onUpdate: async (update) => {
      await deps.updateBaby({ babyId: props.managerBabyDoc._id, ...update });
      await deps.invalidate();
    },
    onMilestoneRedate: async (milestone, occurredAt) => {
      await deps.redateMilestone({
        babyId: props.managerBabyDoc._id,
        milestone,
        occurredAt: Date.parse(occurredAt),
      });
      await deps.invalidate();
    },
    onMilestoneRemove: async (milestone) => {
      await deps.unmarkMilestone({ babyId: props.managerBabyDoc._id, milestone });
      await deps.invalidate();
    },
    onDelete: props.isOwner
      ? async () => {
          await deps.removeBaby({ babyId: props.managerBabyDoc._id });
          deps.navigateToDashboard();
        }
      : null,
    coParents: {
      babyId: props.managerBabyDoc._id,
      isOwner: props.isOwner,
      listing: props.coParentsList,
    },
    open: settings.open,
    onOpenChange: settings.onOpenChange,
    onOpenChangeComplete: settings.onOpenChangeComplete,
  });
}

export function BabySettingsOverlay() {
  const { locale } = useI18n();
  const params = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const loaderData = Route.useLoaderData();
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

  return (
    <BabySettingsOverlayView
      publicId={params.publicId}
      managerBabyDoc={managerBabyDoc}
      isOwner={isOwner}
      profileLocale={loaderData.profile.initialData?.locale ?? locale}
      coParentsList={loaderData.coParentsList}
      deps={{
        updateBaby: (args) => updateBaby(args),
        removeBaby: (args) => removeBaby(args),
        redateMilestone: (args) => redateMilestone(args),
        unmarkMilestone: (args) => unmarkMilestone(args),
        invalidate: () => router.invalidate(),
        navigateToDashboard: () => {
          void navigate({ to: "/dashboard" });
        },
      }}
      renderSettingsPanel={(panelProps) => <SettingsPanel {...panelProps} />}
    />
  );
}
