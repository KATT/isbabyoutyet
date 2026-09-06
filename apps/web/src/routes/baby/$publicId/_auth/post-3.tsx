/**
 * Composer prototype 3 — "chat box".
 *
 * One compact composer box like a messaging app: the text area on top, a
 * toolbar with the photo button under it, then a "Status" section with a
 * vertical stack of shadcn choice cards (defaulting to "No change"). The
 * whole dialog is a photo drop zone — drag an image anywhere over it and a
 * drop hint takes over.
 */
import { Button } from "@workspace/ui/components/button";
import { FormControl, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { Textarea } from "@workspace/ui/components/textarea";
import { CameraIcon, ImageIcon, PaperPlaneTiltIcon, XIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@workspace/convex/convex/_generated/api";
import { allKeyed } from "@workspace/query-prefetch";
import type { ReactNode } from "react";
import { useId } from "react";
import { useFormState } from "react-hook-form";
import { Form, SubmitButton } from "@/components/Form";
import { MAX_UPDATE_MESSAGE_LENGTH } from "@/components/baby/timeline";
import { useI18n } from "@/lib/i18n";
import { useBabyPostPrototypeOverlay } from "@/lib/overlay-nav";
import {
  MilestoneRadioCards,
  NotificationNotice,
  photoDropProps,
  PrototypeComposerOverlay,
  PrototypePhotoInput,
  usePrototypeComposer,
} from "@/routes/baby/$publicId/_auth/-composer-prototypes";
import type { PrototypeComposerBodyProps } from "@/routes/baby/$publicId/_auth/-composer-prototypes";

export const Route = createFileRoute("/baby/$publicId/_auth/post-3")({
  loader: async (opts) => {
    return await allKeyed({
      managerBaby: opts.context.convexPreloader.ensureQueryData(api.baby.getManagerBaby, {
        babyId: opts.params.publicId,
      }),
      subscriptionCount: opts.context.convexPreloader.ensureQueryData(
        api.pushSubscriptions.getSubscriptionCount,
        { babyId: opts.params.publicId },
      ),
    });
  },
  component: PostPrototype3Overlay,
});

function PostPrototype3Overlay() {
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  const overlay = useBabyPostPrototypeOverlay({ publicId: params.publicId, variant: 3 });
  return (
    <PrototypeComposerOverlay
      contentClassName="sm:max-w-lg"
      loaderData={loaderData}
      overlay={overlay}
    >
      {(body) => <ChatComposer {...body} />}
    </PrototypeComposerOverlay>
  );
}

function ChatComposer(props: PrototypeComposerBodyProps) {
  const { t } = useI18n();
  const composer = usePrototypeComposer(props);
  // Subscribe via the hook, not `form.formState.isDirty` (RHF proxy + compiler).
  const { isDirty } = useFormState({ control: composer.form.control });
  const photoInputId = useId();
  return (
    // Negative margin + matching padding so this box (and its drop handlers)
    // covers the whole dialog surface, not just the area inside its padding.
    <div className="group relative -m-4 space-y-4 rounded-xl p-4" {...photoDropProps(composer)}>
      {/* Drop hint: only visible while a file is dragged over the dialog. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-4 border-dashed border-primary bg-background/90 text-center opacity-0 transition-opacity group-data-[dragging=true]:opacity-100"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <ImageIcon className="size-8" weight="fill" />
        </span>
        <p className="text-lg font-black text-foreground">{t("Drop the photo here")}</p>
        <p className="text-sm text-muted-foreground">{t("It will be added to this update")}</p>
      </div>

      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-2xl"
        >
          👶
        </span>
        <div>
          <h3 className="text-lg font-black text-foreground">
            {t("What's new with {{name}}?", { name: props.babyName })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("Write a note, add a photo, or update the status.")}
          </p>
        </div>
      </div>

      <Form form={composer.form} handleSubmit={composer.submit}>
        <PrototypePhotoInput composer={composer} id={photoInputId} />
        <div className="space-y-3">
          {/* Note — the whole card is the textarea's <label>, so clicking
              anywhere in it (including the heading) focuses the field. */}
          <label className={`${SECTION_CARD} block cursor-text`}>
            <SectionLabel>{t("Note")}</SectionLabel>
            <FormField
              control={composer.form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="gap-1">
                  <FormControl>
                    <Textarea
                      className="min-h-20 resize-none rounded-xl border-0 bg-muted/30 shadow-none focus-visible:ring-0"
                      maxLength={MAX_UPDATE_MESSAGE_LENGTH}
                      placeholder={t("Write a note (optional)")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </label>

          {/* Photo — the card is a <label> for the hidden file input, so a
              click anywhere on it opens the picker. Clicks on the buttons
              inside are interactive content and don't re-trigger the label. */}
          <label className={`${SECTION_CARD} block cursor-pointer`} htmlFor={photoInputId}>
            <SectionLabel>{t("Photo")}</SectionLabel>
            {composer.photoFile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-2">
                  {composer.photoPreviewUrl && (
                    <img
                      alt={t("Photo to post")}
                      className="size-16 rounded-lg object-cover"
                      src={composer.photoPreviewUrl}
                    />
                  )}
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {composer.photoFile.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="rounded-full"
                    onClick={composer.openPhotoPicker}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <CameraIcon className="size-4" weight="bold" />
                    {t("Swap the photo")}
                  </Button>
                  <Button
                    className="rounded-full"
                    onClick={composer.removePhoto}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <XIcon className="size-4" />
                    {t("Remove photo")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 text-sm font-semibold text-foreground transition-all outline-none hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
                  onClick={composer.openPhotoPicker}
                  type="button"
                >
                  <CameraIcon className="size-4" weight="bold" />
                  {t("Add a photo")}
                </button>
                <span className="text-xs text-muted-foreground">{t("or drag one in")}</span>
              </div>
            )}
          </label>

          {/* Status */}
          {composer.futureMilestones.length > 0 && (
            <section className={SECTION_CARD}>
              <SectionLabel>{t("Change status")}</SectionLabel>
              <MilestoneRadioCards className="gap-0" composer={composer} />
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <NotificationNotice
              className="min-w-0 flex-1"
              subscriptionCount={props.subscriptionCount}
              tone="inline"
            />
            <SubmitButton
              className="rounded-full font-bold"
              disabled={!isDirty}
              form="context"
              IconComponent={PaperPlaneTiltIcon}
              iconPosition="start"
            >
              {t("Post update")}
            </SubmitButton>
          </div>
        </div>
      </Form>
    </div>
  );
}

/** Each part of the post is its own soft card: label on top, content below. */
const SECTION_CARD =
  "space-y-2 rounded-2xl border border-border/50 bg-card p-3 transition-colors focus-within:border-primary/40";

function SectionLabel(props: { children: ReactNode }) {
  return (
    <span className="block text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
      {props.children}
    </span>
  );
}
