/**
 * Composer prototype 4 — "big news first, photo front and centre".
 *
 * Leads with the fun part: a row of large emoji cards for the milestone
 * ("Just an update" is the default card, so "no status change" is a real
 * choice rather than a radio afterthought). Below it, the note and a big
 * photo drop zone sit side by side with equal size, so neither feels like
 * the "main" input.
 */
import { FormControl, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";
import { ConfettiIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Milestone } from "@workspace/convex/src/types";
import { allKeyed } from "@workspace/query-prefetch";
import { Form, SubmitButton } from "@/components/Form";
import {
  MAX_UPDATE_MESSAGE_LENGTH,
  MILESTONE_EMOJI,
  MILESTONE_META,
} from "@/components/baby/timeline";
import { useI18n } from "@/lib/i18n";
import { useBabyPostPrototypeOverlay } from "@/lib/overlay-nav";
import {
  MilestoneWhenField,
  NotificationNotice,
  PhotoDropzone,
  PrototypeComposerOverlay,
  PrototypePhotoInput,
  usePrototypeComposer,
} from "@/routes/baby/$publicId/_auth/-composer-prototypes";
import type { PrototypeComposerBodyProps } from "@/routes/baby/$publicId/_auth/-composer-prototypes";

export const Route = createFileRoute("/baby/$publicId/_auth/post-4")({
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
  component: PostPrototype4Overlay,
});

function PostPrototype4Overlay() {
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  const overlay = useBabyPostPrototypeOverlay({ publicId: params.publicId, variant: 4 });
  return (
    <PrototypeComposerOverlay
      contentClassName="sm:max-w-xl"
      loaderData={loaderData}
      overlay={overlay}
    >
      {(body) => <BigNewsComposer {...body} />}
    </PrototypeComposerOverlay>
  );
}

function NewsCard(props: {
  emoji: string;
  label: string;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-checked={props.selected}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center text-xs font-bold transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
        props.selected
          ? "scale-[1.03] border-primary bg-primary/10 text-foreground shadow-md"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-primary/5",
      )}
      onClick={props.onSelect}
      role="radio"
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "text-3xl leading-none transition-transform",
          props.selected ? "scale-110" : "grayscale-[0.4]",
        )}
      >
        {props.emoji}
      </span>
      {props.label}
    </button>
  );
}

function BigNewsComposer(props: PrototypeComposerBodyProps) {
  const { t } = useI18n();
  const composer = usePrototypeComposer(props);
  const selectedMilestone: Milestone | null = composer.selectedMilestone;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-xl font-black text-foreground">{t("Share a moment")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("Everyone following {{name}}'s page gets it — a note, a photo, big news, or all three.", {
            name: props.babyName,
          })}
        </p>
      </div>

      <Form form={composer.form} handleSubmit={composer.submit}>
        <PrototypePhotoInput composer={composer} id={undefined} />
        <div className="space-y-5">
          {composer.futureMilestones.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-foreground" id="prototype4-news-label">
                {t("Any big news?")}
              </p>
              <div
                aria-labelledby="prototype4-news-label"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                role="radiogroup"
              >
                <NewsCard
                  emoji="✨"
                  label={t("Just an update")}
                  onSelect={() => {
                    composer.setMilestone("none");
                  }}
                  selected={selectedMilestone == null}
                />
                {composer.futureMilestones.map((candidate) => (
                  <NewsCard
                    emoji={MILESTONE_EMOJI[candidate]}
                    key={candidate}
                    label={t(MILESTONE_META[candidate].labelKey)}
                    onSelect={() => {
                      composer.setMilestone(candidate);
                    }}
                    selected={selectedMilestone === candidate}
                  />
                ))}
              </div>
              {selectedMilestone && (
                <MilestoneWhenField composer={composer} milestone={selectedMilestone} />
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={composer.form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="gap-1.5">
                  <label className="text-sm font-bold text-foreground" htmlFor="prototype4-note">
                    {t("Add a note")}
                  </label>
                  <FormControl>
                    <Textarea
                      className="min-h-40 resize-none rounded-2xl border-2 bg-background sm:h-full"
                      id="prototype4-note"
                      maxLength={MAX_UPDATE_MESSAGE_LENGTH}
                      placeholder={t("Write a message (optional)…")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-bold text-foreground">{t("Add a photo")}</p>
              <PhotoDropzone className="min-h-40 flex-1" composer={composer} />
            </div>
          </div>

          <NotificationNotice
            className=""
            subscriptionCount={props.subscriptionCount}
            tone="callout"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {t("One is enough — a note, a photo or big news.")}
            </p>
            <SubmitButton
              className="rounded-full font-bold"
              form="context"
              IconComponent={selectedMilestone ? ConfettiIcon : PaperPlaneTiltIcon}
              iconPosition="start"
              size="lg"
            >
              {selectedMilestone
                ? t('Post & mark "{{status}}"', {
                    status: t(MILESTONE_META[selectedMilestone].labelKey),
                  })
                : t("Share with everyone")}
            </SubmitButton>
          </div>
        </div>
      </Form>
    </div>
  );
}
