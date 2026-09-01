import {
  AlertDialog,
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
import type { ReactElement } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { z } from "zod";
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
import {
  Form,
  FormCancelButton,
  FormGuardProvider,
  SubmitButton,
  useFormGuard,
  useZodForm,
} from "@/components/Form";
import { FormControl, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { useWatch } from "react-hook-form";
import { htmlDateTimeNow, optionalHtmlDateTime } from "@/lib/html-date";
import { usePreloadedConvexInfiniteQuery } from "@workspace/convex-prefetch";
import { useStoredVisitorId } from "@/lib/use-visitor-id";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import type { TranslationFunction, TranslationKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { useIntersectionAction } from "@/lib/use-intersection-action";
import { useLiveInsertIds } from "@/lib/use-live-insert-ids";
import { useObjectUrl } from "@/lib/use-object-url";
import { useBabyUpdatePhotoOverlayNav } from "@/lib/overlay-nav";
import { BlurImage } from "@/components/blur-image";
import { MILESTONE_LABEL_KEYS } from "./translation-keys";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const TIMELINE_ITEM_LAYOUT = "position" as const;
const TIMELINE_PRESENCE_MODE = "popLayout" as const;
const TIMELINE_REDUCED_MOTION = "user" as const;
const TIMELINE_ITEM_HIDDEN = { opacity: 0, scale: 0.96, y: -12 };
const TIMELINE_ITEM_VISIBLE = { opacity: 1, scale: 1, y: 0 };
const TIMELINE_ITEM_TRANSITION = { damping: 32, stiffness: 420, type: "spring" } as const;

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
  allowedMilestones: ReadonlyArray<Milestone>;
  babyId: Id<"baby">;
  t: TranslationFunction;
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
      const milestone = draft.milestone === "none" ? null : draft.milestone;
      return {
        babyId: opts.babyId,
        message: draft.message || null,
        milestone,
        occurredAt: milestone ? (draft.occurredAt ?? null) : null,
        photo: draft.photo,
        photoId: null,
      };
    });
}

const MILESTONE_META = {
  born: { icon: Confetti, labelKey: MILESTONE_LABEL_KEYS.born },
  gone_to_hospital: { icon: Hospital, labelKey: MILESTONE_LABEL_KEYS.gone_to_hospital },
  labor_started: { icon: Heartbeat, labelKey: MILESTONE_LABEL_KEYS.labor_started },
} as const satisfies Record<Milestone, { icon: typeof Heartbeat; labelKey: TranslationKey }>;

const uploadResponseSchema = z.object({
  storageId: z.string().refine((value): value is Id<"_storage"> => value.length > 0),
});

function getRelativeTimeFromTimestamp(timestamp: number, locale: SupportedLocale): string {
  const now = Date.now();
  const diffInSeconds = Math.floor((timestamp - now) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const intervals = [
    { seconds: 31_536_000, unit: "year" as const },
    { seconds: 2_592_000, unit: "month" as const },
    { seconds: 604_800, unit: "week" as const },
    { seconds: 86_400, unit: "day" as const },
    { seconds: 3600, unit: "hour" as const },
    { seconds: 60, unit: "minute" as const },
  ];

  for (const { seconds, unit } of intervals) {
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
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: opts.timeZone,
    year: "numeric",
  });
}

function isWithinEditWindow(createdAt: number): boolean {
  return Date.now() - createdAt < EDIT_WINDOW_MS;
}

// --- Owner composer ---

type UpdateComposerProps = {
  baby: BabyData;
  babyId: Id<"baby">;
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
  generateUploadUrl: GenerateUploadUrlFn;
  postUpdate: PostUpdateFn;
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
      generateUploadUrl={generateUploadUrl}
      postUpdate={postUpdate}
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
    allowedMilestones: futureMilestones,
    babyId: props.babyId,
    t,
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ChatCircleText className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">{t("Post an update")}</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {t(
          "Everyone following {{name}}'s page will see it. A message, a photo, a milestone — each is optional, any mix works.",
          { name: props.babyName },
        )}
      </p>

      <Form
        form={form}
        handleSubmit={async (values) => {
          const { photo, ...args } = values;
          let photoId: PostUpdateArgs["photoId"] = null;
          if (photo) {
            const uploadUrl = await props.generateUploadUrl({ babyId: args.babyId });
            const response = await fetch(uploadUrl, {
              body: photo,
              headers: { "Content-Type": photo.type },
              method: "POST",
            });
            if (!response.ok) {
              throw new Error(t("Failed to upload photo"));
            }
            const uploaded = uploadResponseSchema.parse(await response.json());
            photoId = uploaded.storageId;
          }

          await props.postUpdate({ ...args, photoId });

          toast.success(t("Update posted!"));
          // No reset needed: the composer lives in a dialog that unmounts on close
          props.onPosted();
        }}
      >
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    aria-label={t("Update message (optional)")}
                    className="min-h-20"
                    maxLength={MAX_UPDATE_MESSAGE_LENGTH}
                    placeholder={t("Write a message (optional)…")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {photoPreviewUrl && (
            <div className="relative w-fit">
              <img
                alt={t("Photo to post")}
                className="max-h-40 rounded-lg border border-border object-cover"
                src={photoPreviewUrl}
              />
              <Button
                aria-label={t("Remove photo")}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow"
                onClick={() => {
                  form.setValue("photo", null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                size="icon"
                type="button"
                variant="secondary"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

          {futureMilestones.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground" id="composer-status-label">
                {t("Status change (optional)")}
              </p>
              <FormField
                control={form.control}
                name="milestone"
                render={(renderProps) => (
                  <RadioGroup
                    aria-labelledby="composer-status-label"
                    className="gap-1.5"
                    onValueChange={(value) => {
                      renderProps.field.onChange(value);
                      // Deselecting forgets any backdate; reselecting starts from "now"
                      if (value === "none") {
                        form.resetField("occurredAt");
                      }
                    }}
                    value={selectedMilestone ?? "none"}
                  >
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value="none" />
                      {t("No status change")}
                    </label>
                    {futureMilestones.map((candidate) => {
                      const meta = MILESTONE_META[candidate];
                      const MilestoneIcon = meta.icon;
                      return (
                        <label
                          className="flex items-center gap-2 text-sm cursor-pointer"
                          key={candidate}
                        >
                          <RadioGroupItem value={candidate} />
                          <MilestoneIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          {t(meta.labelKey)}
                        </label>
                      );
                    })}
                  </RadioGroup>
                )}
              />
              {selectedMilestone && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'This changes the page status to "{{status}}" and notifies everyone subscribed.',
                      {
                        status: t(MILESTONE_META[selectedMilestone].labelKey),
                      },
                    )}
                  </p>
                  <FormField
                    control={form.control}
                    name="occurredAt"
                    render={({ field }) => (
                      <FormItem>
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {t("When did it happen? (optional)")}
                          </span>
                          <FormControl>
                            <Input
                              className="w-fit"
                              max={htmlDateTimeNow(props.baby.timeZone)}
                              type="datetime-local"
                              {...field}
                            />
                          </FormControl>
                        </label>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Optional — leave blank for now. You can change the time later in settings.",
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          <input
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
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
            ref={fileInputRef}
            type="file"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              <Images className="w-4 h-4" />
              {photoFile ? t("Change photo") : t("Add photo (optional)")}
            </Button>
            <SubmitButton form="context" IconComponent={PaperPlaneTilt} iconPosition="start">
              {selectedMilestone
                ? t('Post & mark "{{status}}"', {
                    status: t(MILESTONE_META[selectedMilestone].labelKey),
                  })
                : t("Post update")}
            </SubmitButton>
          </div>

          <p className="text-xs text-muted-foreground text-right">
            {t("Add a message, a photo, or a milestone — any one is enough.")}
          </p>
        </div>
      </Form>
    </div>
  );
}

// --- Timeline items ---

type UpdateTimelineItemProps = {
  baby: BabyData;
  babyName: string;
  isOwner: boolean;
  item: UpdateItemData;
  onDelete: (updateId: Id<"updates">) => Promise<void>;
  onSetAsCurrentPhoto: (updateId: Id<"updates">) => Promise<void>;
  publicId: string;
};

const MILESTONE_EMOJI = {
  born: "🎉",
  gone_to_hospital: "🏥",
  labor_started: "💫",
} satisfies Record<Milestone, string>;

const emptyActionSchema = z.object({});

function PinAsPagePhotoForm(props: {
  onSetAsCurrentPhoto: (updateId: Id<"updates">) => Promise<void>;
  updateId: Id<"updates">;
}) {
  const { t } = useI18n();
  const form = useZodForm({
    defaultValues: {},
    schema: emptyActionSchema,
  });

  return (
    <Form
      form={form}
      handleSubmit={async () => {
        await props.onSetAsCurrentPhoto(props.updateId);
      }}
    >
      <SubmitButton
        aria-label={t("Set as page photo")}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        form="context"
        IconComponent={PushPin}
        iconPosition="start"
        size="icon"
        title={t("Set as page photo")}
        variant="ghost"
      />
    </Form>
  );
}

function DeleteUpdateForm(props: {
  description: string;
  onDelete: (updateId: Id<"updates">) => Promise<void>;
  title: string;
  trigger: ReactElement;
  updateId: Id<"updates">;
}) {
  const { t } = useI18n();
  const overlay = useFormGuard({ onOpenChange: undefined });
  const form = useZodForm({
    defaultValues: {},
    schema: emptyActionSchema,
  });

  return (
    <AlertDialog {...overlay.rootProps}>
      <AlertDialogTrigger render={props.trigger} />
      <AlertDialogContent>
        <FormGuardProvider guard={overlay}>
          <AlertDialogHeader>
            <AlertDialogTitle>{props.title}</AlertDialogTitle>
            <AlertDialogDescription>{props.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <Form
            form={form}
            handleSubmit={async () => {
              await props.onDelete(props.updateId);
            }}
          >
            <AlertDialogFooter>
              <AlertDialogCancel render={<FormCancelButton form="context" />}>
                {t("Cancel")}
              </AlertDialogCancel>
              <SubmitButton
                form="context"
                IconComponent={Trash}
                iconPosition="start"
                variant="destructive"
              >
                {t("Delete")}
              </SubmitButton>
            </AlertDialogFooter>
          </Form>
        </FormGuardProvider>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteEncouragementForm(props: {
  authorName: string;
  encouragementId: Id<"encouragements">;
  onDelete: (encouragementId: Id<"encouragements">, visitorId: string | undefined) => Promise<void>;
  visitorId: string | undefined;
}) {
  const { t } = useI18n();
  const overlay = useFormGuard({ onOpenChange: undefined });
  const form = useZodForm({
    defaultValues: {},
    schema: emptyActionSchema,
  });

  return (
    <AlertDialog {...overlay.rootProps}>
      <AlertDialogTrigger
        render={
          <Button
            aria-label={t("Delete encouragement")}
            className="h-8 w-8"
            size="icon"
            variant="ghost"
          >
            <Trash className="w-4 h-4 text-muted-foreground hover:text-destructive" />
          </Button>
        }
      />
      <AlertDialogContent>
        <FormGuardProvider guard={overlay}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Encouragement?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Are you sure you want to delete this encouragement from {{name}}? This action cannot be undone.",
                { name: props.authorName },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Form
            form={form}
            handleSubmit={async () => {
              await props.onDelete(props.encouragementId, props.visitorId);
            }}
          >
            <AlertDialogFooter>
              <AlertDialogCancel render={<FormCancelButton form="context" />}>
                {t("Cancel")}
              </AlertDialogCancel>
              <SubmitButton
                form="context"
                IconComponent={Trash}
                iconPosition="start"
                variant="destructive"
              >
                {t("Delete")}
              </SubmitButton>
            </AlertDialogFooter>
          </Form>
        </FormGuardProvider>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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
      aria-label={t("Delete update")}
      className="h-8 w-8"
      disabled={Boolean(deleteBlocker)}
      size="icon"
      variant="ghost"
    >
      <Trash className="w-4 h-4 text-muted-foreground hover:text-destructive" />
    </Button>
  );

  return (
    <div className="group flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/25 bg-primary/10 text-lg"
      >
        {bubbleEmoji}
      </span>
      <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border-2 border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="font-medium text-foreground truncate">
              {t("{{name}}'s family", { name: props.babyName })}
            </span>
            {milestoneMeta ? (
              <Badge
                className="shrink-0"
                title={
                  update.occurredAt
                    ? formatOccurredAt(update.occurredAt, {
                        locale,
                        timeZone: props.baby.timeZone,
                      })
                    : undefined
                }
              >
                <MilestoneIcon className="w-3 h-3" />
                {update.milestone && t(MILESTONE_LABEL_KEYS[update.milestone])}
                {update.occurredAt != null && (
                  <span className="font-normal opacity-90">
                    ·{" "}
                    {formatOccurredAt(update.occurredAt, {
                      locale,
                      timeZone: props.baby.timeZone,
                    })}
                  </span>
                )}
              </Badge>
            ) : update.photoUrl ? (
              <Badge className="shrink-0" variant="secondary">
                <Camera className="w-3 h-3" />
                {t("New photo")}
              </Badge>
            ) : (
              <Badge className="shrink-0" variant="secondary">
                {t("Update")}
              </Badge>
            )}
            {update.isCurrentPagePhoto && (
              <Badge className="shrink-0" variant="outline">
                <PushPin className="w-3 h-3" />
                {t("Page photo")}
              </Badge>
            )}
            <span
              className="text-xs text-muted-foreground shrink-0"
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
            <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity shrink-0">
              {canPinPhoto && (
                <PinAsPagePhotoForm
                  onSetAsCurrentPhoto={props.onSetAsCurrentPhoto}
                  updateId={update._id}
                />
              )}
              {deleteBlocker ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        aria-label={t("Delete the {{status}} status first", {
                          status: MILESTONE_LABELS[deleteBlocker],
                        })}
                        className="inline-flex"
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
                <DeleteUpdateForm
                  description={[
                    update.milestone
                      ? t("This also unmarks the milestone on the status card.")
                      : t("This removes the update from the timeline."),
                    update.photoUrl
                      ? t(
                          "If this photo is the current page photo, the previous one takes its place.",
                        )
                      : "",
                    t("This action cannot be undone."),
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onDelete={props.onDelete}
                  title={t("Delete update?")}
                  trigger={deleteButton}
                  updateId={update._id}
                />
              )}
            </div>
          )}
        </div>

        {/* Photo first when present; the caption/message sits last so long
            copy doesn't push the image below the fold of the card. */}
        {update.photoUrl && (
          <TimelinePhoto
            blurDataUrl={update.blurDataUrl}
            photoUrl={update.photoUrl}
            publicId={props.publicId}
            thumbnailUrl={update.thumbnailUrl}
            updateId={update._id}
          />
        )}

        {update.message && (
          <div className="mt-2 min-w-0 max-w-none break-words text-sm text-foreground/90 prose prose-sm [overflow-wrap:anywhere] dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-primary [&_code]:whitespace-pre-wrap [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto">
            <Streamdown>{update.message}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}

type TimelinePhotoProps = {
  blurDataUrl: string | null;
  photoUrl: string;
  publicId: string;
  thumbnailUrl: string | null;
  updateId: Id<"updates">;
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
      className="mt-2 block w-full max-w-full cursor-pointer overflow-hidden rounded-lg border border-border transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <BlurImage
        alt={t("Baby update")}
        blurDataUrl={props.blurDataUrl}
        className="aspect-square max-h-64 w-full object-cover"
        loading="lazy"
        src={inlineUrl}
      />
    </Link>
  );
}

type EncouragementTimelineItemProps = {
  currentVisitorId: string;
  isOwner: boolean;
  item: EncouragementItemData;
  onDelete: (id: Id<"encouragements">, visitorId: string | undefined) => Promise<void>;
  onUpdate: (args: FunctionArgs<typeof api.encouragements.update>) => Promise<void>;
  timeZone: string;
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
  encouragementId: Id<"encouragements">;
  initialMessage: string;
  onClose: () => void;
  onSave: (args: FunctionArgs<typeof api.encouragements.update>) => Promise<void>;
  visitorId: string;
}) {
  const { t } = useI18n();
  const form = useZodForm({
    defaultValues: { message: props.initialMessage },
    schema: encouragementEditSchema(t, {
      encouragementId: props.encouragementId,
      visitorId: props.visitorId,
    }),
  });
  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        await props.onSave(values);
        props.onClose();
      }}
    >
      <div className="space-y-2">
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea aria-label={t("Edit your message")} className="min-h-20" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <SubmitButton form="context" IconComponent={Check} iconPosition="start" size="sm">
            {t("Save")}
          </SubmitButton>
          <PopoverClose render={<FormCancelButton form="context" size="sm" />}>
            <X className="w-3 h-3" />
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
  const overlay = useFormGuard({ onOpenChange: undefined });

  const isOwnPost = encouragement.isMine;
  const canEdit = isOwnPost && isWithinEditWindow(encouragement.createdAt);
  const canDelete = props.isOwner || canEdit;
  const initial = encouragement.authorName.trim().charAt(0).toUpperCase() || "💛";

  return (
    <div className="group flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-secondary/40 text-base font-black text-secondary-foreground"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border-2 border-border/70 bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-foreground truncate">
                {encouragement.authorName}
              </span>
              <span
                className="text-xs text-muted-foreground shrink-0"
                title={new Date(encouragement.createdAt).toLocaleString(locale, {
                  timeZone: props.timeZone,
                })}
              >
                {getRelativeTimeFromTimestamp(encouragement.createdAt, locale)}
              </span>
              {isOwnPost && <span className="text-xs text-primary/70 shrink-0">{t("(you)")}</span>}
            </div>

            <div className="min-w-0 max-w-none break-words text-sm text-muted-foreground prose prose-sm [overflow-wrap:anywhere] dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-primary [&_code]:whitespace-pre-wrap [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto">
              <Streamdown>{encouragement.message}</Streamdown>
            </div>
          </div>

          {(canEdit || canDelete) && (
            <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity shrink-0">
              {canEdit && (
                <Popover {...overlay.rootProps}>
                  <PopoverTrigger
                    render={
                      <Button
                        aria-label={t("Edit encouragement")}
                        className="h-8 w-8"
                        size="icon"
                        variant="ghost"
                      />
                    }
                  >
                    <PencilSimple className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
                    <FormGuardProvider guard={overlay}>
                      <EncouragementEditForm
                        encouragementId={encouragement._id}
                        initialMessage={encouragement.message}
                        onClose={overlay.close}
                        onSave={props.onUpdate}
                        visitorId={props.currentVisitorId}
                      />
                    </FormGuardProvider>
                  </PopoverContent>
                </Popover>
              )}
              {canDelete && (
                <DeleteEncouragementForm
                  authorName={encouragement.authorName}
                  encouragementId={encouragement._id}
                  onDelete={props.onDelete}
                  visitorId={canEdit ? props.currentVisitorId : undefined}
                />
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
  baby: BabyData;
  babyId: Id<"baby">;
  babyName: string;
  isOwner: boolean;
  publicId: string;
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
      visitorId: currentVisitorId || null,
    }),
  });
  const removeUpdate = useMutation(api.updates.remove);
  const setAsCurrentPhoto = useMutation(api.updates.setAsCurrentPhoto);
  const removeEncouragement = useMutation(api.encouragements.remove);
  const updateEncouragement = useMutation(api.encouragements.update);

  const items = timelineQuery.data.pages.flatMap((page) => page.page);

  return (
    <TimelineFeedView
      baby={props.baby}
      babyName={props.babyName}
      currentVisitorId={currentVisitorId}
      fetchNextPage={timelineQuery.fetchNextPage}
      hasNextPage={timelineQuery.hasNextPage}
      isFetchingNextPage={timelineQuery.isFetchingNextPage}
      isOwner={props.isOwner}
      items={items}
      publicId={props.publicId}
      removeEncouragement={removeEncouragement}
      removeUpdate={removeUpdate}
      setAsCurrentPhoto={setAsCurrentPhoto}
      updateEncouragement={updateEncouragement}
    />
  );
}

type TimelineFeedViewProps = {
  baby: BabyData;
  babyName: string;
  currentVisitorId: string;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isOwner: boolean;
  items: Array<TimelineItemData>;
  publicId: string;
  removeEncouragement: RemoveEncouragementFn;
  removeUpdate: RemoveUpdateFn;
  setAsCurrentPhoto: SetAsCurrentPhotoFn;
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
  const liveInsertIds = useLiveInsertIds(
    props.items.map((item) => ({ id: item._id, sortKey: item.postedAt })),
  );
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
      await props.removeEncouragement({ encouragementId, visitorId: visitorId ?? null });
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

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-4 flex items-center gap-2">
        <Heart className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-extrabold text-foreground">{t("Updates & encouragements")}</h3>
      </div>

      {props.items.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border py-10 text-center">
          <p aria-hidden="true" className="text-3xl">
            💌
          </p>
          <p className="mt-3 font-bold text-foreground">{t("Nothing here yet")}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {props.isOwner
              ? t("Post your first update to keep everyone in the loop!")
              : t("Updates from the family will show up here.")}
          </p>
        </div>
      ) : null}

      <MotionConfig reducedMotion={TIMELINE_REDUCED_MOTION}>
        <div className="relative flex flex-col gap-4">
          <AnimatePresence initial={false} mode={TIMELINE_PRESENCE_MODE}>
            {props.items.map((item) => {
              const isLiveInsert = liveInsertIds.has(item._id);
              return (
                <motion.div
                  data-live-insert={isLiveInsert ? "" : undefined}
                  key={item._id}
                  layout={TIMELINE_ITEM_LAYOUT}
                >
                  <motion.div
                    animate={TIMELINE_ITEM_VISIBLE}
                    className="origin-top"
                    exit={TIMELINE_ITEM_HIDDEN}
                    initial={isLiveInsert ? TIMELINE_ITEM_HIDDEN : false}
                    transition={TIMELINE_ITEM_TRANSITION}
                  >
                    {item.kind === "update" ? (
                      <UpdateTimelineItem
                        baby={props.baby}
                        babyName={props.babyName}
                        isOwner={props.isOwner}
                        item={item}
                        onDelete={handleDeleteUpdate}
                        onSetAsCurrentPhoto={handleSetAsCurrentPhoto}
                        publicId={props.publicId}
                      />
                    ) : (
                      <EncouragementTimelineItem
                        currentVisitorId={props.currentVisitorId}
                        isOwner={props.isOwner}
                        item={item}
                        onDelete={handleDeleteEncouragement}
                        onUpdate={handleUpdateEncouragement}
                        timeZone={props.baby.timeZone}
                      />
                    )}
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </MotionConfig>

      <div className="py-2" ref={loadMoreRef}>
        {isFetchingNextPage ? (
          <div className="text-center text-muted-foreground">
            <Spinner className="mx-auto" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
