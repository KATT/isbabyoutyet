import { BabyNav } from "@/components/baby/baby-nav";
import { Baby } from "@phosphor-icons/react";
import { ProgressIndicator } from "@/components/baby/progress-indicator";
import { SettingsPanel } from "@/components/baby/settings-panel";
import { StatusDisplay } from "@/components/baby/status-display";
import type { PreviewBabyData } from "@workspace/convex/src/types";
import {
  getCurrentStatus,
  milestoneVisibilityForPreset,
  MILESTONE_FIELDS,
} from "@workspace/convex/src/types";
import { getThemeCss } from "@/components/baby/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { translate, useI18n } from "@/lib/i18n";
import { robotsNoIndexMeta } from "@/lib/seo";
import { DEFAULT_TIME_ZONE } from "@workspace/convex/src/timeZone";
import { previewCacheHeaders } from "@/lib/cachePolicy";
import * as stylex from "@stylexjs/stylex";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";

function getDefaultBabyData(): PreviewBabyData {
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 7);
  const laborStarted = new Date(now);
  laborStarted.setHours(laborStarted.getHours() - 2);

  return {
    name: "Baby",
    dueDate: dueDate.toISOString(),
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    theme: null,
    timeZone: DEFAULT_TIME_ZONE,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    milestoneVisibility: milestoneVisibilityForPreset("labor"),
    hospitalMessage: null,
    babyBornMessage: null,
    laborStartedMessage: null,
    photoId: null,
  };
}

const searchSchema = z.object({
  name: z.string().default("Baby"),
  dueDate: z.string().nullable().optional(),
  dueDateDisplayMode: z.union([z.literal("exact"), z.literal("message")]).optional(),
  publicDueDateText: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
  laborStarted: z.string().nullable().optional(),
  wentToHospital: z.string().nullable().optional(),
  babyBorn: z.string().nullable().optional(),
  hospitalMessage: z.string().nullable().optional(),
  babyBornMessage: z.string().nullable().optional(),
  laborStartedMessage: z.string().nullable().optional(),
  birthJourney: z
    .union([
      z.literal("labor"),
      z.literal("home_birth"),
      z.literal("planned_c_section"),
      z.literal("custom"),
    ])
    .optional(),
  settings: z.boolean().optional(),
});

export type PreviewSearch = z.infer<typeof searchSchema>;

const styles = stylex.create({
  page: {
    minHeight: "100vh",
    backgroundColor: colors.background,
    backgroundImage: `radial-gradient(color-mix(in oklab, ${colors.border} 80%, transparent) 1.5px, transparent 1.5px)`,
    backgroundSize: "22px 22px",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    paddingInline: spacing.s4,
    paddingTop: spacing.s3,
    paddingBottom: spacing.s1,
  },
  headerInner: {
    marginInline: "auto",
    maxWidth: "48rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.s2,
  },
  brandLink: {
    display: "flex",
    alignItems: "center",
    gap: spacing.s2,
    borderRadius: "9999px",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.border,
    backgroundColor: `color-mix(in oklab, ${colors.background} 85%, transparent)`,
    paddingBlock: spacing.s1_5,
    paddingLeft: spacing.s2,
    paddingRight: spacing.s4,
    backdropFilter: "blur(12px)",
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    textDecoration: "none",
    color: colors.foreground,
    transition: "transform 0.15s ease",
    ":hover": { transform: "rotate(-2deg)" },
  },
  brandIconWell: {
    display: "flex",
    height: "1.75rem",
    width: "1.75rem",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "9999px",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
  },
  brandIcon: {
    height: "1rem",
    width: "1rem",
    color: colors.primary,
  },
  brandName: {
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    fontWeight: 800,
    letterSpacing: "-0.025em",
  },
  main: {
    marginInline: "auto",
    width: "100%",
    maxWidth: "42rem",
    paddingInline: spacing.s4,
    paddingBottom: spacing.s16,
  },
  title: {
    margin: 0,
    paddingInline: spacing.s2,
    paddingTop: spacing.s10,
    paddingBottom: spacing.s10,
    textAlign: "center",
    fontSize: "2.25rem",
    lineHeight: "2.5rem",
    fontWeight: 900,
    letterSpacing: "-0.025em",
    color: colors.foreground,
    textWrap: "balance",
    "@media (min-width: 768px)": {
      paddingTop: "3.5rem",
      fontSize: "3.75rem",
      lineHeight: 1,
    },
  },
  statusCard: {
    borderRadius: "2rem",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingInline: spacing.s6,
    paddingBottom: spacing.s8,
    textAlign: "center",
    boxShadow: `6px 6px 0 0 color-mix(in oklab, ${colors.primary} 30%, transparent)`,
    "@media (min-width: 768px)": { paddingInline: spacing.s10 },
  },
  divider: {
    marginBlock: spacing.s8,
    borderTopWidth: 2,
    borderTopStyle: "dashed",
    borderTopColor: colors.border,
  },
  footer: {
    borderTopWidth: 2,
    borderTopStyle: "solid",
    borderTopColor: `color-mix(in oklab, ${colors.border} 60%, transparent)`,
    backgroundColor: `color-mix(in oklab, ${colors.background} 60%, transparent)`,
    paddingBlock: spacing.s8,
    textAlign: "center",
  },
  footerLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: spacing.s1,
    paddingInline: spacing.s6,
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    fontWeight: 700,
    color: colors.mutedForeground,
    textDecoration: "none",
    transition: "color 0.15s ease",
    ":hover": { color: colors.foreground },
  },
});

export const Route = createFileRoute("/preview")({
  component: PreviewPage,
  validateSearch: searchSchema,
  headers: previewCacheHeaders,
  head: (opts) => ({
    meta: [
      {
        title: translate(opts.match.context.locale, "Preview – {{title}}", {
          title: translate(
            opts.match.context.locale,
            "Is Baby Out Yet? – Share Your Baby's Arrival",
          ),
        }),
      },
      {
        name: "description",
        content: translate(
          opts.match.context.locale,
          "Preview how your baby tracking page will look at different stages.",
        ),
      },
      ...robotsNoIndexMeta(),
    ],
  }),
});

export function PreviewPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { t, locale } = useI18n();
  const birthJourney = search.birthJourney ?? "labor";

  const baby: PreviewBabyData = {
    ...getDefaultBabyData(),
    ...search,
    milestoneVisibility: milestoneVisibilityForPreset(birthJourney),
  };
  const currentStatus = getCurrentStatus(baby);
  const themeCss = getThemeCss(baby.theme);

  const stageMessage =
    currentStatus.type === "born"
      ? baby.babyBornMessage
      : currentStatus.type === "gone_to_hospital"
        ? baby.hospitalMessage
        : currentStatus.type === "labor_started"
          ? baby.laborStartedMessage
          : null;
  const latestUpdate =
    currentStatus.type !== "not_yet" && stageMessage
      ? { message: stageMessage, postedAt: Date.parse(currentStatus.date) }
      : null;

  return (
    <div>
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <SettingsPanel
        baby={baby}
        birthJourney={birthJourney}
        onUpdate={(update) => {
          void navigate({
            search: {
              ...search,
              ...update,
            },
            replace: true,
            resetScroll: false,
          });
        }}
        onMilestoneRedate={(milestone, occurredAt) => {
          void navigate({
            search: {
              ...search,
              [MILESTONE_FIELDS[milestone].date]: occurredAt,
            },
            replace: true,
            resetScroll: false,
          });
        }}
        onMilestoneRemove={(milestone) => {
          void navigate({
            search: {
              ...search,
              [MILESTONE_FIELDS[milestone].date]: null,
            },
            replace: true,
            resetScroll: false,
          });
        }}
        open={!!search.settings}
        onOpenChange={(open) => {
          void navigate({
            search: {
              ...search,
              settings: open || undefined,
            },
            replace: true,
            resetScroll: false,
          });
        }}
        onOpenChangeComplete={null}
        profileLocale={locale}
        onDelete={null}
        coParents={null}
      />

      <div {...stylex.props(styles.page)}>
        <header {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.headerInner)}>
            <Link to="/" {...stylex.props(styles.brandLink)}>
              <span {...stylex.props(styles.brandIconWell)}>
                <Baby {...stylex.props(styles.brandIcon)} />
              </span>
              <span {...stylex.props(styles.brandName)}>isbabyoutyet</span>
            </Link>
            <BabyNav
              shareButton={null}
              shareOpen={false}
              onDismissShare={null}
              postUpdateButton={null}
              postUpdateOpen={false}
              onDismissPostUpdate={null}
              onSettingsOpened={null}
              settingsButton={{
                to: "/preview",
                search: {
                  ...search,
                  settings: search.settings ? undefined : true,
                },
                replace: true,
                resetScroll: false,
              }}
              settingsOpen={!!search.settings}
              onDismissSettings={null}
            />
          </div>
        </header>

        <main {...stylex.props(styles.main)}>
          <h1 {...stylex.props(styles.title)}>{t("Is {{name}} out yet?", { name: baby.name })}</h1>

          <section {...stylex.props(styles.statusCard)}>
            <StatusDisplay
              publicId={null}
              baby={baby}
              currentStatus={currentStatus}
              latestUpdate={latestUpdate}
              photoUrl={null}
              thumbnailUrl={null}
              blurDataUrl={null}
            />
            <div {...stylex.props(styles.divider)} aria-hidden="true" />
            <ProgressIndicator baby={baby} currentStatus={currentStatus} />
          </section>
        </main>

        <footer {...stylex.props(styles.footer)}>
          <Link to="/" {...stylex.props(styles.footerLink)}>
            {t("Having a baby? Are people messaging you non-stop? Create your own page →")}
          </Link>
        </footer>
      </div>
    </div>
  );
}
