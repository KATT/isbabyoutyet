/**
 * Composer prototype 2 — "three equal cards".
 *
 * Message, photo and milestone get identical weight: three big tappable cards
 * you can expand in any combination. A card lights up and gets an "Added"
 * pill once it has content, and the footer summarises what's going out.
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Badge } from "@workspace/ui/components/badge";
import { FormControl, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";
import { CheckIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { api } from "@workspace/convex/convex/_generated/api";
import { allKeyed } from "@workspace/query-prefetch";
import { Form, SubmitButton } from "@/components/Form";
import { MAX_UPDATE_MESSAGE_LENGTH, MILESTONE_META } from "@/components/baby/timeline";
import { useI18n } from "@/lib/i18n";
import { useBabyPostPrototypeOverlay } from "@/lib/overlay-nav";
import {
  MilestoneChips,
  MilestoneWhenField,
  NotificationNotice,
  PhotoDropzone,
  PrototypeComposerOverlay,
  PrototypePhotoInput,
  usePrototypeComposer,
} from "@/routes/baby/$publicId/_auth/-composer-prototypes";
import type { PrototypeComposerBodyProps } from "@/routes/baby/$publicId/_auth/-composer-prototypes";

export const Route = createFileRoute("/baby/$publicId/_auth/post-2")({
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
  component: PostPrototype2Overlay,
});

function PostPrototype2Overlay() {
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  const overlay = useBabyPostPrototypeOverlay({ publicId: params.publicId, variant: 2 });
  return (
    <PrototypeComposerOverlay
      contentClassName="sm:max-w-lg"
      loaderData={loaderData}
      overlay={overlay}
    >
      {(body) => <ThreeCardsComposer {...body} />}
    </PrototypeComposerOverlay>
  );
}

function CardHeader(props: {
  added: boolean;
  description: string;
  emoji: string;
  title: string;
}) {
  const { t } = useI18n();
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full text-xl transition-colors",
          props.added ? "bg-primary text-primary-foreground" : "bg-primary/10",
        )}
      >
        {props.emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="flex items-center gap-2 text-base font-bold text-foreground">
          {props.title}
          {props.added && (
            <Badge className="gap-1">
              <CheckIcon weight="bold" />
              {t("Added")}
            </Badge>
          )}
        </span>
        <span className="text-xs font-normal text-muted-foreground">{props.description}</span>
      </span>
    </>
  );
}

function ComposerCard(props: {
  added: boolean;
  children: ReactNode;
  description: string;
  emoji: string;
  title: string;
  value: string;
}) {
  return (
    <AccordionItem
      className={cn(
        "rounded-2xl border-2 bg-card transition-colors not-last:border-b-2",
        props.added ? "border-primary/60" : "border-border data-open:border-primary/30",
      )}
      value={props.value}
    >
      <AccordionTrigger className="items-center gap-3 rounded-2xl px-4 py-3 hover:no-underline">
        <CardHeader
          added={props.added}
          description={props.description}
          emoji={props.emoji}
          title={props.title}
        />
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">{props.children}</AccordionContent>
    </AccordionItem>
  );
}

function ThreeCardsComposer(props: PrototypeComposerBodyProps) {
  const { t } = useI18n();
  const composer = usePrototypeComposer(props);
  const hasMessage = composer.message.trim().length > 0;
  const hasPhoto = composer.photoFile != null;
  const selectedMilestone = composer.selectedMilestone;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-xl font-black text-foreground">{t("Post an update")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("Pick anything below — one is enough, or mix all three.")}
        </p>
      </div>
      <NotificationNotice
        className=""
        subscriptionCount={props.subscriptionCount}
        tone="callout"
      />

      <Form form={composer.form} handleSubmit={composer.submit}>
        <PrototypePhotoInput composer={composer} id={undefined} />
        <Accordion className="gap-2" defaultValue={["message", "photo", "milestone"]} multiple>
          <ComposerCard
            added={hasMessage}
            description={t("Tell everyone what's happening")}
            emoji="💬"
            title={t("Message")}
            value="message"
          >
            <FormField
              control={composer.form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      aria-label={t("Update message (optional)")}
                      className="min-h-24 bg-background"
                      maxLength={MAX_UPDATE_MESSAGE_LENGTH}
                      placeholder={t("Write a message (optional)…")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </ComposerCard>

          <ComposerCard
            added={hasPhoto}
            description={t("A moment worth sharing")}
            emoji="📸"
            title={t("Photo")}
            value="photo"
          >
            <PhotoDropzone className="h-32 w-full" composer={composer} />
          </ComposerCard>

          {composer.futureMilestones.length > 0 && (
            <ComposerCard
              added={selectedMilestone != null}
              description={t("Labour, hospital or born — updates the page status")}
              emoji="🎉"
              title={t("Big news")}
              value="milestone"
            >
              <div className="space-y-3">
                <MilestoneChips className="flex flex-wrap gap-2" composer={composer} size="md" />
                {selectedMilestone && (
                  <MilestoneWhenField composer={composer} milestone={selectedMilestone} />
                )}
              </div>
            </ComposerCard>
          )}
        </Accordion>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {composer.hasContent ? (
              <>
                <span>{t("Sharing:")}</span>
                {hasMessage && <Badge variant="secondary">💬 {t("Message")}</Badge>}
                {hasPhoto && <Badge variant="secondary">📸 {t("Photo")}</Badge>}
                {selectedMilestone && (
                  <Badge variant="secondary">
                    {t(MILESTONE_META[selectedMilestone].labelKey)}
                  </Badge>
                )}
              </>
            ) : (
              <span>{t("Nothing added yet")}</span>
            )}
          </div>
          <SubmitButton
            className="rounded-full font-bold"
            form="context"
            IconComponent={PaperPlaneTiltIcon}
            iconPosition="start"
          >
            {selectedMilestone
              ? t('Post & mark "{{status}}"', {
                  status: t(MILESTONE_META[selectedMilestone].labelKey),
                })
              : t("Post update")}
          </SubmitButton>
        </div>
      </Form>
    </div>
  );
}
