/**
 * Shared plumbing for the "Post an update" composer redesign prototypes
 * (`/post-2`, `/post-3`, `/post-4`). Each route file owns its own layout;
 * this file owns everything that is identical across them: the manager-baby
 * dialog shell, the form (same schema as the production composer), photo
 * picking/validation, and the upload-then-post submit.
 *
 * Temporary: once a variant is chosen, fold it into `post.tsx` /
 * `UpdateComposer` and delete this file plus the other prototypes.
 */
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogTitle } from "@workspace/ui/components/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field";
import { FormControl, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { cn } from "@workspace/ui/lib/utils";
import { BellRingingIcon, CameraIcon, ImagesIcon, XIcon } from "@phosphor-icons/react";
import { FormGuardProvider, useZodForm } from "@/components/Form";
import {
  composerSchema,
  MAX_PHOTO_SIZE_BYTES,
  MILESTONE_EMOJI,
  MILESTONE_META,
  uploadResponseSchema,
} from "@/components/baby/timeline";
import { useCompleteOnboardingStep } from "@/components/onboarding/onboarding-host";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { BabyData, Milestone } from "@workspace/convex/src/types";
import { FORBIDDEN, getMilestonePolicy } from "@workspace/convex/src/types";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { Fragment, useId, useRef } from "react";
import type { DragEvent, ReactElement } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";
import { htmlDateTimeNow } from "@/lib/html-date";
import { useI18n } from "@/lib/i18n";
import type { OverlayControl } from "@/lib/overlay-nav";
import { useObjectUrl } from "@/lib/use-object-url";
import { ForbiddenDialog } from "@/routes/baby/$publicId/_auth/-forbidden-dialog";
import { managerDocToBabyData } from "@/routes/baby/$publicId/route";

export type PrototypeComposerBodyProps = {
  baby: BabyData;
  babyId: Id<"baby">;
  babyName: string;
  onPosted: () => void;
  /** People who get a push notification when this posts. */
  subscriptionCount: number;
};

type PrototypeComposerOverlayProps = {
  /** Renders the variant's composer body; remounted when the journey stage advances. */
  children: (body: PrototypeComposerBodyProps) => ReactElement;
  contentClassName: string;
  loaderData: {
    managerBaby: PreloadedConvexQuery<typeof api.baby.getManagerBaby>;
    subscriptionCount: PreloadedConvexQuery<typeof api.pushSubscriptions.getSubscriptionCount>;
  };
  overlay: OverlayControl;
};

/** Manager-baby dialog shell shared by every prototype route. */
export function PrototypeComposerOverlay(props: PrototypeComposerOverlayProps) {
  const completeOnboardingStep = useCompleteOnboardingStep();
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const managerBabyQuery = usePreloadedConvexQuery(
    api.baby.getManagerBaby,
    props.loaderData.managerBaby,
  );
  const subscriptionCountQuery = usePreloadedConvexQuery(
    api.pushSubscriptions.getSubscriptionCount,
    props.loaderData.subscriptionCount,
  );
  if (managerBabyQuery.data === FORBIDDEN) {
    return <ForbiddenDialog overlay={props.overlay} />;
  }
  const managerBabyDoc = managerBabyQuery.data;
  const baby = managerDocToBabyData(managerBabyDoc);
  // Remount the body when the journey stage advances so a stale milestone
  // selection cannot resurface after an unmark — same trick as UpdateComposer.
  const stageKey = getMilestonePolicy(baby).currentStatus.type;

  return (
    <Dialog {...props.overlay.rootProps}>
      <DialogContent className={props.contentClassName} initialFocus={contentRef} ref={contentRef}>
        <DialogTitle className="sr-only">{t("Post an update")}</DialogTitle>
        <FormGuardProvider guard={props.overlay.guard}>
          <Fragment key={stageKey}>
            {props.children({
              baby,
              babyId: managerBabyDoc._id,
              babyName: managerBabyDoc.name,
              onPosted: () => {
                void completeOnboardingStep({ stepId: "post_update" });
                props.overlay.close();
              },
              subscriptionCount:
                subscriptionCountQuery.data === FORBIDDEN ? 0 : subscriptionCountQuery.data,
            })}
          </Fragment>
        </FormGuardProvider>
      </DialogContent>
    </Dialog>
  );
}

type PostUpdateArgs = FunctionArgs<typeof api.updates.post>;

/**
 * The production composer's form + submit, exposed as plain values and
 * handlers so each prototype can lay them out differently.
 */
export function usePrototypeComposer(props: PrototypeComposerBodyProps) {
  const { t } = useI18n();
  const postUpdate = useMutation(api.updates.post);
  const generateUploadUrl = useMutation(api.baby.generateUploadUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const milestonePolicy = getMilestonePolicy(props.baby);
  const futureMilestones = milestonePolicy.visibleMilestones.filter(milestonePolicy.canMark);
  const schema = composerSchema({
    allowedMilestones: futureMilestones,
    babyId: props.babyId,
    t,
    timeZone: props.baby.timeZone,
  });

  const form = useZodForm({
    schema,
    context: milestonePolicy.currentStatus.type,
    defaultValues: {
      message: "",
      milestone: "none",
      occurredAt: "",
      photo: null,
    },
  });

  const message = useWatch({ control: form.control, name: "message" }) ?? "";
  const milestone = useWatch({ control: form.control, name: "milestone" });
  const photoFile = useWatch({ control: form.control, name: "photo" }) ?? null;
  const selectedMilestone =
    milestone != null && milestone !== "none" && futureMilestones.includes(milestone)
      ? milestone
      : null;
  const photoPreviewUrl = useObjectUrl(photoFile);

  const acceptPhoto = (file: File | undefined) => {
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
  };

  return {
    acceptPhoto,
    baby: props.baby,
    babyName: props.babyName,
    fileInputRef,
    form,
    futureMilestones,
    hasContent: message.trim().length > 0 || photoFile != null || selectedMilestone != null,
    message,
    openPhotoPicker: () => {
      fileInputRef.current?.click();
    },
    photoFile,
    photoPreviewUrl,
    removePhoto: () => {
      form.setValue("photo", null, { shouldDirty: true });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    selectedMilestone,
    setMilestone: (value: Milestone | "none") => {
      form.setValue("milestone", value, { shouldDirty: true });
      if (value === "none") {
        form.resetField("occurredAt");
      }
    },
    submit: async (values: PostUpdateArgs & { photo: File | null }) => {
      const { photo, ...args } = values;
      let photoId: PostUpdateArgs["photoId"] = null;
      if (photo) {
        const uploadUrl = await generateUploadUrl({ babyId: args.babyId });
        const response = await fetch(uploadUrl, {
          body: photo,
          headers: { "Content-Type": photo.type },
          method: "POST",
        });
        if (!response.ok) {
          throw new Error(t("Failed to upload photo"));
        }
        photoId = uploadResponseSchema.parse(await response.json()).storageId;
      }
      await postUpdate({ ...args, photoId });
      toast.success(t("Update posted!"));
      props.onPosted();
    },
  };
}

export type PrototypeComposer = ReturnType<typeof usePrototypeComposer>;

/** Hidden `<input type="file">` behind every "add photo" affordance. */
export function PrototypePhotoInput(props: { composer: PrototypeComposer; id: string | undefined }) {
  return (
    <input
      accept="image/*"
      className="hidden"
      id={props.id}
      onChange={(event) => {
        props.composer.acceptPhoto(event.target.files?.[0]);
      }}
      ref={props.composer.fileInputRef}
      type="file"
    />
  );
}

/**
 * Spread onto any element to make it accept a dropped image. While a file is
 * dragged over it the element gets `data-dragging="true"` (toggled straight on
 * the DOM node from the drag events — no render state needed) so descendants
 * can style a drop hint with `group-data-[dragging=true]:…`.
 */
function setDragging(event: DragEvent<HTMLElement>, dragging: boolean) {
  if (dragging) {
    event.currentTarget.dataset.dragging = "true";
  } else {
    delete event.currentTarget.dataset.dragging;
  }
}

export function photoDropProps(composer: PrototypeComposer) {
  return {
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      // Ignore leave events fired when moving between children.
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
        return;
      }
      setDragging(event, false);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(event, true);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(event, false);
      composer.acceptPhoto(event.dataTransfer.files[0]);
    },
  };
}

/**
 * "Posting notifies N people — you can still cancel." Every post schedules a
 * push to subscribers with a grace window (the countdown toast on the page),
 * so this makes the consequence and the escape hatch visible up front.
 */
export function NotificationNotice(props: {
  className: string;
  subscriptionCount: number;
  tone: "callout" | "inline";
}) {
  const { t } = useI18n();
  const count = props.subscriptionCount;
  return (
    <div
      className={cn(
        "flex items-start gap-2 text-xs text-muted-foreground",
        props.tone === "callout" && "rounded-xl border border-primary/20 bg-primary/5 px-3 py-2",
        props.className,
      )}
    >
      <BellRingingIcon className="mt-0.5 size-4 shrink-0 text-primary" weight="fill" />
      <span>
        <span className="font-semibold text-foreground">
          {count === 1
            ? t("Posting notifies {{count}} subscriber.", { count })
            : t("Posting notifies {{count}} subscribers.", { count })}
        </span>{" "}
        {t("You get a minute to cancel before it goes out.")}
      </span>
    </div>
  );
}

/**
 * Milestone picker as a vertical stack of shadcn "choice cards" (FieldLabel
 * wrapping a Field + RadioGroupItem): each option is a full-width tappable
 * card with a one-line description, and the checked card tints. "No change"
 * is the explicit default, like the original composer. When a milestone is
 * picked, its when-question expands right under that card, indented.
 */
export function MilestoneRadioCards(props: { className: string; composer: PrototypeComposer }) {
  const { t } = useI18n();
  const composer = props.composer;
  const idPrefix = useId();
  const options: Array<{
    description: string;
    emoji: string;
    label: string;
    value: Milestone | "none";
  }> = [
    {
      description: t("Just a note or a photo. The page status stays the same."),
      emoji: "💬",
      label: t("No change"),
      value: "none",
    },
    ...composer.futureMilestones.map((candidate) => ({
      description: milestoneDescription({ babyName: composer.babyName, milestone: candidate, t }),
      emoji: MILESTONE_EMOJI[candidate],
      label: t(MILESTONE_META[candidate].labelKey),
      value: candidate,
    })),
  ];
  return (
    <FormField
      control={composer.form.control}
      name="milestone"
      render={() => (
        <FormItem className={props.className}>
          <RadioGroup
            aria-label={t("Status change (optional)")}
            className="gap-1.5"
            onValueChange={(value) => {
              const picked = composer.futureMilestones.find((candidate) => candidate === value);
              composer.setMilestone(picked ?? "none");
            }}
            value={composer.selectedMilestone ?? "none"}
          >
            {options.map((option) => {
              const id = `${idPrefix}-${option.value}`;
              const selected = option.value !== "none" && composer.selectedMilestone === option.value;
              return (
                <Fragment key={option.value}>
                  <FieldLabel
                    // Quiet unchecked cards: hairline border + faint fill; only
                    // the checked one gets the primary tint.
                    className="cursor-pointer border-border/40 bg-muted/30 hover:border-border/70 has-[>[data-slot=field]]:rounded-xl"
                    htmlFor={id}
                  >
                    <Field className="*:data-[slot=field]:p-2" orientation="horizontal">
                      <span
                        aria-hidden="true"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-base"
                      >
                        {option.emoji}
                      </span>
                      <FieldContent className="gap-0">
                        <FieldTitle>{option.label}</FieldTitle>
                        <FieldDescription className="text-xs">{option.description}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem
                        className="border-foreground/30"
                        id={id}
                        value={option.value}
                      />
                    </Field>
                  </FieldLabel>
                  {selected && option.value !== "none" && (
                    <div className="ml-4 border-l-2 border-primary/40 pl-3">
                      <MilestoneWhenField composer={composer} milestone={option.value} />
                    </div>
                  )}
                </Fragment>
              );
            })}
          </RadioGroup>
        </FormItem>
      )}
    />
  );
}

function milestoneDescription(opts: {
  babyName: string;
  milestone: Milestone;
  t: ReturnType<typeof useI18n>["t"];
}) {
  switch (opts.milestone) {
    case "labor_started":
      return opts.t("The page will say labour has started.");
    case "gone_to_hospital":
      return opts.t("The page will say you're at the hospital.");
    case "born":
      return opts.t("The page will announce that {{name}} is here.", { name: opts.babyName });
  }
}

/**
 * Milestone picker as tappable emoji chips. Tapping the selected chip again
 * clears it (= "no status change"), so no separate "none" option is needed.
 */
export function MilestoneChips(props: {
  className: string;
  composer: PrototypeComposer;
  size: "sm" | "md" | "lg";
}) {
  const { t } = useI18n();
  const composer = props.composer;
  return (
    <div aria-label={t("Status change (optional)")} className={props.className} role="group">
      {composer.futureMilestones.map((candidate) => {
        const pressed = composer.selectedMilestone === candidate;
        return (
          <button
            aria-pressed={pressed}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border-2 font-semibold transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
              props.size === "lg"
                ? "h-11 px-4 text-sm"
                : props.size === "md"
                  ? "h-9 px-3 text-sm"
                  : "h-8 px-2.5 text-xs",
              pressed
                ? "border-primary bg-primary text-primary-foreground shadow-md"
                : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5",
            )}
            key={candidate}
            onClick={() => {
              composer.setMilestone(pressed ? "none" : candidate);
            }}
            type="button"
          >
            <span aria-hidden="true" className="text-base leading-none">
              {MILESTONE_EMOJI[candidate]}
            </span>
            {t(MILESTONE_META[candidate].labelKey)}
          </button>
        );
      })}
    </div>
  );
}

/** Backdate field + explainer shown once a milestone is selected. */
export function MilestoneWhenField(props: { composer: PrototypeComposer; milestone: Milestone }) {
  const { t } = useI18n();
  const composer = props.composer;
  // The chip and the submit label already say which status is being set (and
  // every post notifies subscribers anyway), so this row only asks the one
  // thing that is specific to the milestone: when it happened.
  const question = (() => {
    switch (props.milestone) {
      case "labor_started":
        return t("When did labour start?");
      case "gone_to_hospital":
        return t("When did you head to the hospital?");
      case "born":
        return t("When was {{name}} born?", { name: composer.babyName });
    }
  })();
  return (
    <FormField
      control={composer.form.control}
      name="occurredAt"
      render={({ field }) => (
        <FormItem className="gap-1 px-1">
          <label className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-foreground">{question}</span>
            <FormControl>
              <Input
                className="h-8 w-fit"
                max={htmlDateTimeNow(composer.baby.timeZone)}
                type="datetime-local"
                {...field}
              />
            </FormControl>
            <span className="text-xs text-muted-foreground">
              {t("Optional. You can change this later.")}
            </span>
          </label>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Photo affordance that is impossible to miss: a big dashed drop target when
 * empty, the picked photo (with change/remove) once chosen.
 */
export function PhotoDropzone(props: { className: string; composer: PrototypeComposer }) {
  const { t } = useI18n();
  const composer = props.composer;
  if (composer.photoPreviewUrl) {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl", props.className)}>
        <img
          alt={t("Photo to post")}
          className="h-full w-full object-cover"
          src={composer.photoPreviewUrl}
        />
        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-linear-to-t from-black/60 to-transparent p-2">
          <Button
            className="h-8 rounded-full"
            onClick={composer.openPhotoPicker}
            size="sm"
            type="button"
            variant="secondary"
          >
            <ImagesIcon className="size-4" />
            {t("Change photo")}
          </Button>
          <Button
            aria-label={t("Remove photo")}
            className="size-8 rounded-full"
            onClick={composer.removePhoto}
            size="icon"
            type="button"
            variant="secondary"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
    );
  }
  return (
    <button
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center text-sm font-medium text-foreground transition-colors outline-none hover:border-primary hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50",
        props.className,
      )}
      onClick={composer.openPhotoPicker}
      type="button"
      {...photoDropProps(composer)}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <CameraIcon className="size-6" />
      </span>
      <span>{t("Add a photo")}</span>
      <span className="text-xs font-normal text-muted-foreground">
        {t("Tap to choose, or drop one here")}
      </span>
    </button>
  );
}
