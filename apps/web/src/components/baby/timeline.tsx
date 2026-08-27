import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import type { PopoverActions } from "@workspace/ui/components/popover";
import { useMutation } from "convex/react";
import {
  Camera,
  ChatCircleText,
  Check,
  Confetti,
  Heart,
  Heartbeat,
  Hospital,
  Images,
  PaperPlaneTilt,
  PencilSimple,
  PushPin,
  Trash,
  X,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import * as z from "zod";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";
import type {
  InitiatedConvexInfiniteQuery,
  PreloadedConvexInfiniteQuery,
} from "@workspace/convex-prefetch";
import type { BabyData, Milestone } from "@workspace/convex/src/types";
import {
  getBlockingLaterMilestone,
  getMilestonePolicy,
  MILESTONE_LABELS,
} from "@workspace/convex/src/types";
import { Form, SubmitButton, useZodForm } from "@/components/Form";
import { FormControl, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { useWatch } from "react-hook-form";
import { htmlDateTimeNow, optionalHtmlDateTime } from "@/lib/html-date";
import { usePreloadedConvexInfiniteQuery } from "@workspace/convex-prefetch";
import { useStoredVisitorId } from "@/lib/use-visitor-id";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import type { TranslationFunction, TranslationKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { useIntersectionAction } from "@/lib/use-intersection-action";
import { useObjectUrl } from "@/lib/use-object-url";
import { useBabyUpdatePhotoOverlayNav } from "@/lib/overlay-nav";
import { BlurImage } from "@/components/blur-image";
import { MILESTONE_LABEL_KEYS } from "./translation-keys";
import * as stylex from "@stylexjs/stylex";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  composer: {},
  headerRow: {
    alignItems: "center",
    display: "flex",
    gap: spacing.s2,
  },
  iconPrimary: {
    color: colors.primary,
    flexShrink: 0,
  },
  iconMuted: {
    color: colors.mutedForeground,
    flexShrink: 0,
  },
  iconMutedHoverFg: {
    color: {
      ":hover": colors.foreground,
      default: colors.mutedForeground,
    },
  },
  iconMutedHoverDestructive: {
    color: {
      ":hover": colors.destructive,
      default: colors.mutedForeground,
    },
  },
  photoPreviewWrap: {
    position: "relative",
    width: "fit-content",
  },
  photoPreview: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "1px",
    maxHeight: "10rem",
    objectFit: "cover",
  },
  photoRemoveBtn: {
    position: "absolute",
    right: "-0.5rem",
    top: "-0.5rem",
  },
  radioLabel: {
    alignItems: "center",
    cursor: "pointer",
    display: "flex",
    fontSize: "0.875rem",
    gap: spacing.s2,
    lineHeight: "1.25rem",
  },
  occurredLabel: {
    display: "block",
  },
  hiddenInput: {
    display: "none",
  },
  avatar: {
    alignItems: "center",
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "2px",
    display: "flex",
    flexShrink: 0,
    fontSize: "1.125rem",
    height: "2.5rem",
    justifyContent: "center",
    marginTop: spacing.s1,
    width: "2.5rem",
  },
  avatarUpdate: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 25%, transparent)`,
  },
  avatarEncouragement: {
    backgroundColor: `color-mix(in oklab, ${colors.secondary} 40%, transparent)`,
    borderColor: colors.border,
    color: colors.secondaryForeground,
    fontSize: "1rem",
    fontWeight: 900,
  },
  bubble: {
    borderRadius: "1.5rem",
    borderBottomLeftRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "2px",
    flexGrow: 1,
    minWidth: 0,
    padding: spacing.s4,
  },
  bubbleUpdate: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 5%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 20%, transparent)`,
  },
  bubbleEncouragement: {
    backgroundColor: `color-mix(in oklab, ${colors.muted} 30%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.border} 70%, transparent)`,
  },
  itemRow: {
    alignItems: "flex-start",
    display: "flex",
    gap: spacing.s3,
  },
  metaRow: {
    alignItems: "flex-start",
    display: "flex",
    gap: spacing.s2,
    justifyContent: "space-between",
  },
  metaLeft: {
    alignItems: "center",
    display: "flex",
    flexGrow: 1,
    flexWrap: "wrap",
    gap: spacing.s2,
    minWidth: 0,
  },
  metaLeftEnc: {
    flexGrow: 1,
    minWidth: 0,
  },
  authorName: {
    color: colors.foreground,
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  relativeTime: {
    color: colors.mutedForeground,
    flexShrink: 0,
    fontSize: "0.75rem",
    lineHeight: "1rem",
  },
  youTag: {
    color: `color-mix(in oklab, ${colors.primary} 70%, transparent)`,
    flexShrink: 0,
    fontSize: "0.75rem",
    lineHeight: "1rem",
  },
  occurredNote: {
    fontWeight: 400,
    opacity: 0.9,
  },
  actionRow: {
    display: "flex",
    flexShrink: 0,
    gap: spacing.s1,
    opacity: {
      "@media (min-width: 768px)": 0,
      default: 1,
    },
    transitionDuration: "150ms",
    transitionProperty: "opacity",
    transitionTimingFunction: "ease",
  },
  // Reveal actions on group hover/focus — StyleX parent selectors
  itemRowHover: {
    ":hover > div:last-child > div:last-child": {
      opacity: 1,
    },
    ":focus-within > div:last-child > div:last-child": {
      opacity: 1,
    },
  },
  markdown: {
    color: `color-mix(in oklab, ${colors.foreground} 90%, transparent)`,
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    marginTop: spacing.s2,
    maxWidth: "none",
    minWidth: 0,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  markdownMuted: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    maxWidth: "none",
    minWidth: 0,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  photoLink: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "1px",
    cursor: "pointer",
    display: "block",
    marginTop: spacing.s2,
    maxWidth: "100%",
    overflow: "hidden",
    outline: {
      ":focus-visible": `2px solid ${colors.primary}`,
      default: "none",
    },
    outlineOffset: "2px",
    transform: {
      ":hover": "scale(1.02)",
      default: null,
    },
    transitionDuration: "150ms",
    transitionProperty: "transform",
    transitionTimingFunction: "ease",
    width: "100%",
  },
  photoImg: {
    aspectRatio: "1 / 1",
    maxHeight: "16rem",
    objectFit: "cover",
    width: "100%",
  },
  emptyState: {
    borderColor: colors.border,
    borderRadius: "1.5rem",
    borderStyle: "dashed",
    borderWidth: "2px",
    paddingBlock: spacing.s10,
    textAlign: "center",
  },
  emptyEmoji: {
    fontSize: "1.875rem",
    lineHeight: 1,
    margin: 0,
  },
  loadMore: {
    paddingBlock: spacing.s2,
  },
  loadMoreInner: {
    color: colors.mutedForeground,
    display: "flex",
    justifyContent: "center",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.s4,
  },
  sectionHeader: {
    alignItems: "center",
    display: "flex",
    gap: spacing.s2,
    marginBottom: spacing.s4,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: "1.125rem",
    fontWeight: 800,
    lineHeight: "1.75rem",
    margin: 0,
  },
  emptyTitle: {
    color: colors.foreground,
    fontWeight: 700,
    marginTop: spacing.s3,
  },
  emptyBody: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
    fontWeight: 500,
    lineHeight: "1.25rem",
    marginTop: spacing.s1,
  },
  editForm: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.s2,
  },
  editActions: {
    display: "flex",
    gap: spacing.s2,
  },
  iconSm: {
    height: "0.75rem",
    width: "0.75rem",
  },
  iconMd: {
    height: "1rem",
    width: "1rem",
  },
  iconLg: {
    height: "1.25rem",
    width: "1.25rem",
  },
  tooltipAnchor: {
    display: "inline-flex",
  },
  headerBlock: {
    marginBottom: spacing.s4,
  },
  encAuthorRow: {
    alignItems: "center",
    display: "flex",
    gap: spacing.s2,
    marginBottom: spacing.s1,
  },
  dateInputFit: {
    width: "fit-content",
  },
  timelinePhoto: {
    aspectRatio: "1",
    maxHeight: "16rem",
    objectFit: "cover",
    width: "100%",
  },
});

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type TimelineItemData = FunctionReturnType<typeof api.timeline.listByBaby>["page"][number];
type UpdateItemData = Extract<TimelineItemData, { kind: "update" }>;
type EncouragementItemData = Extract<TimelineItemData, { kind: "encouragement" }>;

const MAX_UPDATE_MESSAGE_LENGTH = 1000;
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * A post's three fields are mutually inclusive: any combination works, as
 * long as at least one is present. The message is trimmed BEFORE validation,
 * so a whitespace-only message counts as no message (matching the backend).
 * `occurredAt` starts empty (= "now"); a filled value backdates the milestone.
 */
type PostUpdateArgs = FunctionArgs<typeof api.updates.post>;

function composerSchema(opts: {
  t: TranslationFunction;
  allowedMilestones: readonly Milestone[];
  babyId: Id<"baby">;
  timeZone: string;
}) {
  return z
    .object({
      message: z.string().trim().max(MAX_UPDATE_MESSAGE_LENGTH),
      milestone: z.union([
        z.literal("none"),
        z.literal("labor_started"),
        z.literal("gone_to_hospital"),
        z.literal("born"),
      ]),
      occurredAt: optionalHtmlDateTime(opts.t, opts.timeZone),
      photo: z.custom<File>().nullable(),
    })
    .refine(
      (draft) => draft.message.length > 0 || draft.milestone !== "none" || draft.photo != null,
      { error: opts.t("Add a message, a photo, or a milestone to post") },
    )
    .refine(
      (draft) => draft.milestone === "none" || opts.allowedMilestones.includes(draft.milestone),
      {
        error: opts.t("That status has already been marked"),
        path: ["milestone"],
      },
    )
    .transform((draft): PostUpdateArgs & { photo: File | null } => {
      const milestone = draft.milestone === "none" ? undefined : draft.milestone;
      return {
        babyId: opts.babyId,
        message: draft.message || undefined,
        milestone,
        occurredAt: milestone ? (draft.occurredAt ?? undefined) : undefined,
        photo: draft.photo,
      };
    });
}

const MILESTONE_META = {
  labor_started: { labelKey: MILESTONE_LABEL_KEYS.labor_started, icon: Heartbeat },
  gone_to_hospital: { labelKey: MILESTONE_LABEL_KEYS.gone_to_hospital, icon: Hospital },
  born: { labelKey: MILESTONE_LABEL_KEYS.born, icon: Confetti },
} as const satisfies Record<Milestone, { labelKey: TranslationKey; icon: typeof Heartbeat }>;

function getRelativeTimeFromTimestamp(timestamp: number, locale: SupportedLocale): string {
  const now = Date.now();
  const diffInSeconds = Math.floor((timestamp - now) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const intervals = [
    { unit: "year" as const, seconds: 31536000 },
    { unit: "month" as const, seconds: 2592000 },
    { unit: "week" as const, seconds: 604800 },
    { unit: "day" as const, seconds: 86400 },
    { unit: "hour" as const, seconds: 3600 },
    { unit: "minute" as const, seconds: 60 },
  ];

  for (const { unit, seconds } of intervals) {
    const interval = Math.floor(Math.abs(diffInSeconds) / seconds);
    if (interval >= 1) {
      return rtf.format(diffInSeconds > 0 ? interval : -interval, unit);
    }
  }

  return rtf.format(0, "second");
}

function formatOccurredAt(
  timestamp: number,
  opts: { locale: SupportedLocale; timeZone: string },
): string {
  return new Date(timestamp).toLocaleString(opts.locale, {
    timeZone: opts.timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isWithinEditWindow(createdAt: number): boolean {
  return Date.now() - createdAt < EDIT_WINDOW_MS;
}

// --- Owner composer ---

type UpdateComposerProps = {
  babyId: Id<"baby">;
  baby: BabyData;
  babyName: string;
  /** Called after a successful post (e.g. to close the containing dialog) */
  onPosted: () => void;
};

type PostUpdateFn = (
  args: FunctionArgs<typeof api.updates.post>,
) => Promise<FunctionReturnType<typeof api.updates.post>>;

type GenerateUploadUrlFn = (
  args: FunctionArgs<typeof api.baby.generateUploadUrl>,
) => Promise<FunctionReturnType<typeof api.baby.generateUploadUrl>>;

type UpdateComposerFormProps = UpdateComposerProps & {
  postUpdate: PostUpdateFn;
  generateUploadUrl: GenerateUploadUrlFn;
};

/** Hooks into Convex, then delegates to the pure `UpdateComposerForm`. */
export function UpdateComposer(props: UpdateComposerProps) {
  const postUpdate = useMutation(api.updates.post);
  const generateUploadUrl = useMutation(api.baby.generateUploadUrl);
  const currentStatus = getMilestonePolicy(props.baby).currentStatus;
  // Remount when the journey stage advances so a stale milestone selection
  // cannot resurface after an unmark — no sync effect needed.
  return (
    <UpdateComposerForm
      key={currentStatus.type}
      {...props}
      postUpdate={postUpdate}
      generateUploadUrl={generateUploadUrl}
    />
  );
}

function UpdateComposerForm(props: UpdateComposerFormProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The status only moves forward: offer only stages AFTER the current one,
  // and none at all once "Born" is reached
  const milestonePolicy = getMilestonePolicy(props.baby);
  const currentStatus = milestonePolicy.currentStatus;
  const futureMilestones = milestonePolicy.visibleMilestones.filter(milestonePolicy.canMark);
  const schema = composerSchema({
    t,
    allowedMilestones: futureMilestones,
    babyId: props.babyId,
    timeZone: props.baby.timeZone,
  });

  const form = useZodForm({
    schema,
    // RHF re-runs the resolver when this changes (status advanced in another tab)
    context: currentStatus.type,
    defaultValues: {
      message: "",
      milestone: "none",
      // Empty means "happening now"; fill in to backdate
      occurredAt: "",
      photo: null,
    },
  });

  const milestone = useWatch({ control: form.control, name: "milestone" });
  const photoFile = useWatch({ control: form.control, name: "photo" });

  // Mask stale selections while the form remounts on status change via key.
  const selectedMilestone =
    milestone != null && milestone !== "none" && futureMilestones.includes(milestone)
      ? milestone
      : null;

  const photoPreviewUrl = useObjectUrl(photoFile ?? null);

  return (
    <Stack gap="s3">
      <div {...stylex.props(styles.headerRow)}>
        <ChatCircleText size={20} {...stylex.props(styles.iconPrimary)} />
        <Text as="h3" size="lg" weight="semibold">
          {t("Post an update")}
        </Text>
      </div>
      <Text size="sm" tone="muted">
        {t(
          "Everyone following {{name}}'s page will see it. A message, a photo, a milestone — each is optional, any mix works.",
          { name: props.babyName },
        )}
      </Text>

      <Form
        form={form}
        handleSubmit={async (values) => {
          const { photo, ...args } = values;
          let photoId: PostUpdateArgs["photoId"];
          if (photo) {
            const uploadUrl = await props.generateUploadUrl({ babyId: args.babyId });
            const response = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": photo.type },
              body: photo,
            });
            if (!response.ok) {
              throw new Error(t("Failed to upload photo"));
            }
            const uploaded = (await response.json()) as { storageId: Id<"_storage"> };
            photoId = uploaded.storageId;
          }

          await props.postUpdate({ ...args, photoId });

          toast.success(t("Update posted!"));
          // No reset needed: the composer lives in a dialog that unmounts on close
          props.onPosted();
        }}
      >
        <Stack gap="s3">
          <FormField
            control={form.control}
            name="message"
            render={(renderProps) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder={t("Write a message (optional)…")}
                    aria-label={t("Update message (optional)")}
                    maxLength={MAX_UPDATE_MESSAGE_LENGTH}
                    {...renderProps.field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {photoPreviewUrl && (
            <div {...stylex.props(styles.photoPreviewWrap)}>
              <img
                src={photoPreviewUrl}
                alt={t("Photo to post")}
                {...stylex.props(styles.photoPreview)}
              />
              <span {...stylex.props(styles.photoRemoveBtn)}>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  shape="pill"
                  onClick={() => {
                    form.setValue("photo", null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  aria-label={t("Remove photo")}
                >
                  <X size={12} />
                </Button>
              </span>
            </div>
          )}

          {futureMilestones.length > 0 && (
            <Stack gap="s2">
              <Text as="p" id="composer-status-label" size="xs" weight="medium" tone="muted">
                {t("Status change (optional)")}
              </Text>
              <FormField
                control={form.control}
                name="milestone"
                render={(renderProps) => (
                  <RadioGroup
                    aria-labelledby="composer-status-label"
                    value={selectedMilestone ?? "none"}
                    onValueChange={(value) => {
                      renderProps.field.onChange(value);
                      // Deselecting forgets any backdate; reselecting starts from "now"
                      if (value === "none") form.resetField("occurredAt");
                    }}
                  >
                    <label {...stylex.props(styles.radioLabel)}>
                      <RadioGroupItem value="none" />
                      {t("No status change")}
                    </label>
                    {futureMilestones.map((candidate) => {
                      const meta = MILESTONE_META[candidate];
                      const MilestoneIcon = meta.icon;
                      return (
                        <label key={candidate} {...stylex.props(styles.radioLabel)}>
                          <RadioGroupItem value={candidate} />
                          <MilestoneIcon size={14} {...stylex.props(styles.iconMuted)} />
                          {t(meta.labelKey)}
                        </label>
                      );
                    })}
                  </RadioGroup>
                )}
              />
              {selectedMilestone && (
                <Stack gap="s2">
                  <Text size="xs" tone="muted">
                    {t(
                      'This changes the page status to "{{status}}" and notifies everyone subscribed.',
                      {
                        status: t(MILESTONE_META[selectedMilestone].labelKey),
                      },
                    )}
                  </Text>
                  <FormField
                    control={form.control}
                    name="occurredAt"
                    render={(renderProps) => (
                      <FormItem>
                        <label {...stylex.props(styles.occurredLabel)}>
                          <Stack gap="s1">
                            <Text as="span" size="xs" weight="medium" tone="muted">
                              {t("When did it happen? (optional)")}
                            </Text>
                            <FormControl>
                              <div {...stylex.props(styles.dateInputFit)}>
                                <Input
                                  type="datetime-local"
                                  max={htmlDateTimeNow(props.baby.timeZone)}
                                  {...renderProps.field}
                                />
                              </div>
                            </FormControl>
                          </Stack>
                        </label>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Text size="xs" tone="muted">
                    {t(
                      "Optional — leave blank for now. You can change the time later in settings.",
                    )}
                  </Text>
                </Stack>
              )}
            </Stack>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!file.type.startsWith("image/")) {
                toast.error(t("Please select an image file"));
                return;
              }
              if (file.size > MAX_PHOTO_SIZE_BYTES) {
                toast.error(t("Photo must be 10 MB or smaller"));
                return;
              }
              form.setValue("photo", file, { shouldDirty: true });
            }}
            {...stylex.props(styles.hiddenInput)}
          />

          <Inline gap="s2" justify="between" fullWidth>
            <Button
              type="button"
              variant="outline"
              size="sm"
              shape="pill"
              onClick={() => fileInputRef.current?.click()}
            >
              <Images size={16} />
              {photoFile ? t("Change photo") : t("Add photo (optional)")}
            </Button>
            <SubmitButton
              form="context"
              IconComponent={PaperPlaneTilt}
              iconPosition="start"
              shape="pill"
            >
              {selectedMilestone
                ? t('Post & mark "{{status}}"', {
                    status: t(MILESTONE_META[selectedMilestone].labelKey),
                  })
                : t("Post update")}
            </SubmitButton>
          </Inline>

          <Text size="xs" tone="muted" align="end">
            {t("Add a message, a photo, or a milestone — any one is enough.")}
          </Text>
        </Stack>
      </Form>
    </Stack>
  );
}

// --- Timeline items ---

type UpdateTimelineItemProps = {
  item: UpdateItemData;
  publicId: string;
  baby: BabyData;
  babyName: string;
  isOwner: boolean;
  onDelete: (updateId: Id<"updates">) => Promise<void>;
  onSetAsCurrentPhoto: (updateId: Id<"updates">) => Promise<void>;
};

const MILESTONE_EMOJI: Record<Milestone, string> = {
  labor_started: "💫",
  gone_to_hospital: "🏥",
  born: "🎉",
};

function UpdateTimelineItem(props: UpdateTimelineItemProps) {
  const { locale, t } = useI18n();
  const update = props.item.update;
  const milestoneMeta = update.milestone ? MILESTONE_META[update.milestone] : null;
  const MilestoneIcon = milestoneMeta?.icon ?? Camera;
  const bubbleEmoji = update.milestone
    ? MILESTONE_EMOJI[update.milestone]
    : update.photoUrl
      ? "📸"
      : "💬";
  const canPinPhoto = props.isOwner && !!update.photoUrl && !update.isCurrentPagePhoto;
  const deleteBlocker = update.milestone
    ? getBlockingLaterMilestone(props.baby, update.milestone)
    : null;

  const deleteButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t("Delete update")}
      disabled={Boolean(deleteBlocker)}
    >
      <Trash size={16} {...stylex.props(styles.iconMutedHoverDestructive)} />
    </Button>
  );

  return (
    <div data-timeline-item="" {...stylex.props(styles.itemRow)}>
      <span {...stylex.props(styles.avatar, styles.avatarUpdate)} aria-hidden="true">
        {bubbleEmoji}
      </span>
      <div {...stylex.props(styles.bubble, styles.bubbleUpdate)}>
        <div {...stylex.props(styles.metaRow)}>
          <div {...stylex.props(styles.metaLeft)}>
            <span {...stylex.props(styles.authorName)}>
              {t("{{name}}'s family", { name: props.babyName })}
            </span>
            {milestoneMeta ? (
              <Badge
                title={
                  update.occurredAt
                    ? formatOccurredAt(update.occurredAt, {
                        locale,
                        timeZone: props.baby.timeZone,
                      })
                    : undefined
                }
              >
                <MilestoneIcon size={12} />
                {update.milestone && t(MILESTONE_LABEL_KEYS[update.milestone])}
                {update.occurredAt != null && (
                  <span {...stylex.props(styles.occurredNote)}>
                    ·{" "}
                    {formatOccurredAt(update.occurredAt, {
                      locale,
                      timeZone: props.baby.timeZone,
                    })}
                  </span>
                )}
              </Badge>
            ) : update.photoUrl ? (
              <Badge variant="secondary">
                <Camera size={12} />
                {t("New photo")}
              </Badge>
            ) : (
              <Badge variant="secondary">{t("Update")}</Badge>
            )}
            {update.isCurrentPagePhoto && (
              <Badge variant="outline">
                <PushPin size={12} />
                {t("Page photo")}
              </Badge>
            )}
            <span
              {...stylex.props(styles.relativeTime)}
              title={t("Posted {{date}}", {
                date: new Date(props.item.postedAt).toLocaleString(locale, {
                  timeZone: props.baby.timeZone,
                }),
              })}
            >
              {getRelativeTimeFromTimestamp(props.item.postedAt, locale)}
            </span>
          </div>

          {props.isOwner && (
            <div {...stylex.props(styles.actionRow)}>
              {canPinPhoto && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("Set as page photo")}
                  title={t("Set as page photo")}
                  onClick={() => props.onSetAsCurrentPhoto(update._id)}
                >
                  <PushPin size={16} {...stylex.props(styles.iconMutedHoverFg)} />
                </Button>
              )}
              {deleteBlocker ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        {...stylex.props(styles.tooltipAnchor)}
                        aria-label={t("Delete the {{status}} status first", {
                          status: MILESTONE_LABELS[deleteBlocker],
                        })}
                      />
                    }
                  >
                    {deleteButton}
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("Delete the {{status}} status first", {
                      status: MILESTONE_LABELS[deleteBlocker],
                    })}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger render={deleteButton} />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("Delete update?")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {update.milestone
                          ? t("This also unmarks the milestone on the status card.")
                          : t("This removes the update from the timeline.")}{" "}
                        {update.photoUrl
                          ? t(
                              "If this photo is the current page photo, the previous one takes its place.",
                            )
                          : ""}{" "}
                        {t("This action cannot be undone.")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => props.onDelete(update._id)}
                      >
                        {t("Delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>

        {/* Photo first when present; the caption/message sits last so long
            copy doesn't push the image below the fold of the card. */}
        {update.photoUrl && (
          <TimelinePhoto
            publicId={props.publicId}
            updateId={update._id}
            photoUrl={update.photoUrl}
            thumbnailUrl={update.thumbnailUrl}
            blurDataUrl={update.blurDataUrl}
          />
        )}

        {update.message && (
          <div {...stylex.props(styles.markdown)}>
            <Streamdown>{update.message}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}

type TimelinePhotoProps = {
  publicId: string;
  updateId: Id<"updates">;
  photoUrl: string;
  thumbnailUrl: string | null;
  blurDataUrl: string | null;
};

function TimelinePhoto(props: TimelinePhotoProps) {
  const { t } = useI18n();
  const inlineUrl = props.thumbnailUrl ?? props.photoUrl;
  const photo = useBabyUpdatePhotoOverlayNav({
    publicId: props.publicId,
    updateId: props.updateId,
  });

  return (
    <Link
      {...photo.openLink}
      aria-label={t("View photo full size")}
      {...stylex.props(styles.photoLink)}
    >
      <BlurImage
        src={inlineUrl}
        alt={t("Baby update")}
        blurDataUrl={props.blurDataUrl}
        objectFit="cover"
        loading="lazy"
        {...stylex.props(styles.timelinePhoto)}
      />
    </Link>
  );
}

type EncouragementTimelineItemProps = {
  item: EncouragementItemData;
  isOwner: boolean;
  timeZone: string;
  currentVisitorId: string;
  onDelete: (id: Id<"encouragements">, visitorId: string | undefined) => Promise<void>;
  onUpdate: (args: FunctionArgs<typeof api.encouragements.update>) => Promise<void>;
};

function encouragementEditSchema(
  t: TranslationFunction,
  args: Pick<FunctionArgs<typeof api.encouragements.update>, "encouragementId" | "visitorId">,
) {
  return z
    .object({
      message: z.string().trim().min(1, t("Message cannot be empty")),
    })
    .transform((values): FunctionArgs<typeof api.encouragements.update> => ({
      ...args,
      message: values.message,
    }));
}
/**
 * Mounted only while the edit popover is open, so the form initializes from
 * the current message on every reveal — no reset bookkeeping.
 */
function EncouragementEditForm(props: {
  initialMessage: string;
  encouragementId: Id<"encouragements">;
  visitorId: string;
  onSave: (args: FunctionArgs<typeof api.encouragements.update>) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const form = useZodForm({
    schema: encouragementEditSchema(t, {
      encouragementId: props.encouragementId,
      visitorId: props.visitorId,
    }),
    defaultValues: { message: props.initialMessage },
  });
  const isSaving = form.formState.isSubmitting;

  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        await props.onSave(values);
        props.onClose();
      }}
    >
      <div {...stylex.props(styles.editForm)}>
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea aria-label={t("Edit your message")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div {...stylex.props(styles.editActions)}>
          <SubmitButton form="context" IconComponent={Check} iconPosition="start" size="sm">
            {t("Save")}
          </SubmitButton>
          <PopoverClose
            render={<Button size="sm" type="button" variant="outline" disabled={isSaving} />}
          >
            <X size={12} {...stylex.props(styles.iconSm)} />
            {t("Cancel")}
          </PopoverClose>
        </div>
      </div>
    </Form>
  );
}

function EncouragementTimelineItem(props: EncouragementTimelineItemProps) {
  const { locale, t } = useI18n();
  const encouragement = props.item.encouragement;
  const actionsRef = useRef<PopoverActions | null>(null);

  const isOwnPost = encouragement.isMine;
  const canEdit = isOwnPost && isWithinEditWindow(encouragement.createdAt);
  const canDelete = props.isOwner || canEdit;
  const initial = encouragement.authorName.trim().charAt(0).toUpperCase() || "💛";

  return (
    <div data-timeline-item="" {...stylex.props(styles.itemRow, styles.itemRowHover)}>
      <span {...stylex.props(styles.avatar, styles.avatarEncouragement)} aria-hidden="true">
        {initial}
      </span>
      <div {...stylex.props(styles.bubble, styles.bubbleEncouragement)}>
        <div {...stylex.props(styles.metaRow)}>
          <div {...stylex.props(styles.metaLeftEnc)}>
            <div {...stylex.props(styles.metaLeft)}>
              <span {...stylex.props(styles.authorName)}>
                {encouragement.authorName}
              </span>
              <span
                {...stylex.props(styles.relativeTime)}
                title={new Date(encouragement.createdAt).toLocaleString(locale, {
                  timeZone: props.timeZone,
                })}
              >
                {getRelativeTimeFromTimestamp(encouragement.createdAt, locale)}
              </span>
              {isOwnPost ? <span {...stylex.props(styles.youTag)}>{t("(you)")}</span> : null}
            </div>

            <div {...stylex.props(styles.markdownMuted)}>
              <Streamdown>{encouragement.message}</Streamdown>
            </div>
          </div>

          {(canEdit || canDelete) && (
            <div {...stylex.props(styles.actionRow)}>
              {canEdit && (
                <Popover actionsRef={actionsRef}>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("Edit encouragement")}
                      />
                    }
                  >
                    <PencilSimple size={16} {...stylex.props(styles.iconMutedHoverFg)} />
                  </PopoverTrigger>
                  <PopoverContent align="end">
                    <EncouragementEditForm
                      initialMessage={encouragement.message}
                      encouragementId={encouragement._id}
                      visitorId={props.currentVisitorId}
                      onSave={props.onUpdate}
                      onClose={() => {
                        actionsRef.current?.close();
                      }}
                    />
                  </PopoverContent>
                </Popover>
              )}
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("Delete encouragement")}
                      >
                        <Trash size={16} {...stylex.props(styles.iconMutedHoverDestructive)} />
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("Delete Encouragement?")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t(
                          "Are you sure you want to delete this encouragement from {{name}}? This action cannot be undone.",
                          { name: encouragement.authorName },
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          props.onDelete(
                            encouragement._id,
                            canEdit ? props.currentVisitorId : undefined,
                          )
                        }
                      >
                        {t("Delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Feed ---

type TimelineFeedProps = {
  babyId: Id<"baby">;
  publicId: string;
  baby: BabyData;
  babyName: string;
  isOwner: boolean;
  /** Prefetched infinite timeline handle from the route loader (SSR first page). */
  timeline:
    | PreloadedConvexInfiniteQuery<typeof api.timeline.listByBaby>
    | InitiatedConvexInfiniteQuery<typeof api.timeline.listByBaby>;
};

type RemoveUpdateFn = (
  args: FunctionArgs<typeof api.updates.remove>,
) => Promise<FunctionReturnType<typeof api.updates.remove>>;
type SetAsCurrentPhotoFn = (
  args: FunctionArgs<typeof api.updates.setAsCurrentPhoto>,
) => Promise<FunctionReturnType<typeof api.updates.setAsCurrentPhoto>>;
type RemoveEncouragementFn = (
  args: FunctionArgs<typeof api.encouragements.remove>,
) => Promise<FunctionReturnType<typeof api.encouragements.remove>>;
type UpdateEncouragementFn = (
  args: FunctionArgs<typeof api.encouragements.update>,
) => Promise<FunctionReturnType<typeof api.encouragements.update>>;

/** Hooks into Convex, then delegates to the pure `TimelineFeedView`. */
export function TimelineFeed(props: TimelineFeedProps) {
  // Client visitor id for isMine; SSR snapshot is "" so the first paint matches
  // the loader handle (no visitorId), then remixArgs picks it up on the client.
  const currentVisitorId = useStoredVisitorId();
  // visitorId only marks the caller's own encouragements (isMine); the
  // credential itself is never returned by the query. Remix after mount so
  // the first render matches the SSR handle (no visitorId).
  const timelineQuery = usePreloadedConvexInfiniteQuery(api.timeline.listByBaby, {
    handle: props.timeline,
    remixArgs: (args) => ({
      ...args,
      ...(currentVisitorId ? { visitorId: currentVisitorId } : {}),
    }),
  });
  const removeUpdate = useMutation(api.updates.remove);
  const setAsCurrentPhoto = useMutation(api.updates.setAsCurrentPhoto);
  const removeEncouragement = useMutation(api.encouragements.remove);
  const updateEncouragement = useMutation(api.encouragements.update);

  const items = timelineQuery.data.pages.flatMap((page) => page.page);

  return (
    <TimelineFeedView
      publicId={props.publicId}
      baby={props.baby}
      babyName={props.babyName}
      isOwner={props.isOwner}
      items={items}
      hasNextPage={timelineQuery.hasNextPage}
      isFetchingNextPage={timelineQuery.isFetchingNextPage}
      fetchNextPage={timelineQuery.fetchNextPage}
      currentVisitorId={currentVisitorId}
      removeUpdate={removeUpdate}
      setAsCurrentPhoto={setAsCurrentPhoto}
      removeEncouragement={removeEncouragement}
      updateEncouragement={updateEncouragement}
    />
  );
}

type TimelineFeedViewProps = {
  publicId: string;
  baby: BabyData;
  babyName: string;
  isOwner: boolean;
  items: TimelineItemData[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  currentVisitorId: string;
  removeUpdate: RemoveUpdateFn;
  setAsCurrentPhoto: SetAsCurrentPhotoFn;
  removeEncouragement: RemoveEncouragementFn;
  updateEncouragement: UpdateEncouragementFn;
};

/**
 * Presentational timeline feed body — wired by {@link TimelineFeed}.
 */
function TimelineFeedView(props: TimelineFeedViewProps) {
  const { t } = useI18n();
  const hasNextPage = props.hasNextPage;
  const isFetchingNextPage = props.isFetchingNextPage;
  const fetchNextPage = props.fetchNextPage;
  const loadMoreRef = useIntersectionAction({
    enabled: hasNextPage && !isFetchingNextPage,
    onIntersect: () => {
      void fetchNextPage();
    },
    threshold: 0.1,
  });

  const handleDeleteUpdate = async (updateId: Id<"updates">) => {
    try {
      await props.removeUpdate({ updateId });
      toast.success(t("Update removed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to remove update"));
    }
  };

  const handleSetAsCurrentPhoto = async (updateId: Id<"updates">) => {
    try {
      await props.setAsCurrentPhoto({ updateId });
      toast.success(t("Set as the page photo"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to set page photo"));
    }
  };

  const handleDeleteEncouragement = async (
    encouragementId: Id<"encouragements">,
    visitorId: string | undefined,
  ) => {
    try {
      await props.removeEncouragement({ encouragementId, visitorId });
      toast.success(t("Encouragement removed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to remove encouragement"));
    }
  };

  const handleUpdateEncouragement = async (
    args: FunctionArgs<typeof api.encouragements.update>,
  ) => {
    try {
      await props.updateEncouragement(args);
      toast.success(t("Encouragement updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to update encouragement"));
      throw error;
    }
  };

  if (props.items.length === 0) {
    return (
      <div {...stylex.props(styles.section)}>
        <div {...stylex.props(styles.sectionHeader)}>
          <Heart size={20} {...stylex.props(styles.iconPrimary, styles.iconLg)} />
          <h3 {...stylex.props(styles.sectionTitle)}>
            {t("Updates & encouragements")}
          </h3>
        </div>
        <div {...stylex.props(styles.emptyState)}>
          <p {...stylex.props(styles.emptyEmoji)} aria-hidden="true">
            💌
          </p>
          <p {...stylex.props(styles.emptyTitle)}>{t("Nothing here yet")}</p>
          <p {...stylex.props(styles.emptyBody)}>
            {props.isOwner
              ? t("Post your first update to keep everyone in the loop!")
              : t("Updates from the family will show up here.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.sectionHeader)}>
        <Heart size={20} {...stylex.props(styles.iconPrimary, styles.iconLg)} />
        <h3 {...stylex.props(styles.sectionTitle)}>{t("Updates & encouragements")}</h3>
      </div>

      <div {...stylex.props(styles.section)}>
        {props.items.map((item) =>
          item.kind === "update" ? (
            <UpdateTimelineItem
              key={item._id}
              item={item}
              publicId={props.publicId}
              baby={props.baby}
              babyName={props.babyName}
              isOwner={props.isOwner}
              onDelete={handleDeleteUpdate}
              onSetAsCurrentPhoto={handleSetAsCurrentPhoto}
            />
          ) : (
            <EncouragementTimelineItem
              key={item._id}
              item={item}
              isOwner={props.isOwner}
              timeZone={props.baby.timeZone}
              currentVisitorId={props.currentVisitorId}
              onDelete={handleDeleteEncouragement}
              onUpdate={handleUpdateEncouragement}
            />
          ),
        )}

        {/* Infinite scroll trigger */}
        <div ref={loadMoreRef} {...stylex.props(styles.loadMore)}>
          {isFetchingNextPage ? (
            <div {...stylex.props(styles.loadMoreInner)}>
              <Spinner />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
