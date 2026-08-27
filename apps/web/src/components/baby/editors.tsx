import {
  Form,
  FormCancelButton,
  FormOverlayProvider,
  shouldBlockOverlayDismiss,
  SubmitButton,
  useFormOverlay,
  useZodForm,
} from "@/components/Form";
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
import { Button } from "@workspace/ui/components/button";
import { FormControl, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { DueDateDisplayFields } from "@/components/baby/dueDateDisplayFields";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Check, Clock, Trash } from "@phosphor-icons/react";
import type { FunctionArgs } from "convex/server";
import { useFormState, useWatch } from "react-hook-form";
import * as z from "zod";
import type { api } from "@workspace/convex/convex/_generated/api";
import {
  BIRTH_JOURNEYS,
  getBlockingLaterMilestone,
  MILESTONE_LABELS,
} from "@workspace/convex/src/types";
import type {
  BabyData,
  BabyUpdateHandler,
  BirthJourney,
  Milestone,
  MilestoneRedateHandler,
  MilestoneRemoveHandler,
} from "@workspace/convex/src/types";
import { JourneyMilestoneEditor } from "./journey-milestone-editor";
import { htmlDate, htmlDateTime, htmlDateTimeNow } from "@/lib/html-date";
import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { getThemeOption, THEME_OPTIONS } from "./utils";

type BabyPatch = Omit<FunctionArgs<typeof api.baby.update>, "babyId">;

const emptyActionSchema = z.object({});

// Uncontrolled popovers: forms mount fresh when the popup opens so
// defaultValues stay current without a reset. Cancel uses PopoverClose +
// FormCancelButton; successful save/delete closes via useFormOverlay.close.

type EditorFormProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
  onClose: () => void;
};

function EditorActions(props: { isBusy: boolean }) {
  const { t } = useI18n();
  // Subscribe via useFormState — reading form.formState via the Proxy is not a
  // reliable re-render under the React Compiler. FormCancelButton owns
  // isSubmitting for Cancel; keep isDirty / isBusy for Save.
  const { isDirty } = useFormState();
  return (
    <div className="flex gap-2 justify-end">
      <PopoverClose render={<FormCancelButton form="context" size="sm" disabled={props.isBusy} />}>
        {t("Cancel")}
      </PopoverClose>
      <SubmitButton
        form="context"
        IconComponent={Check}
        iconPosition="start"
        size="sm"
        disabled={!isDirty || props.isBusy}
      >
        {t("Save")}
      </SubmitButton>
    </div>
  );
}

type DueDateEditorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

function dueDateSchema(t: TranslationFunction) {
  return z
    .object({
      date: htmlDate(t),
      showExactDueDate: z.boolean(),
      publicDueDateText: z.string().trim().max(80, t("Keep this under 80 characters")),
    })
    .superRefine((values, ctx) => {
      if (values.showExactDueDate && !values.date) {
        ctx.addIssue({
          code: "custom",
          path: ["date"],
          message: t("Pick a date"),
        });
      }
    })
    .transform(
      (values): Pick<BabyPatch, "dueDate" | "dueDateDisplayMode" | "publicDueDateText"> => ({
        dueDate: values.date,
        dueDateDisplayMode: values.showExactDueDate ? "exact" : "message",
        publicDueDateText: values.publicDueDateText || null,
      }),
    );
}

export function DueDateEditor(props: DueDateEditorProps) {
  const { t } = useI18n();
  const overlay = useFormOverlay({
    onOpenChange: (open, eventDetails) => {
      // Keep the popover open while the native date picker (rendered outside
      // the popover) is in use; Base UI replaces onInteractOutside with
      // onOpenChange reasons + eventDetails.cancel()
      if (
        !open &&
        (eventDetails.reason === "outside-press" || eventDetails.reason === "focus-out")
      ) {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement && activeElement.type === "date") {
          eventDetails.cancel();
        }
      }
    },
  });

  return (
    <Popover {...overlay.rootProps}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            {t("Edit")}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
        <FormOverlayProvider overlay={overlay}>
          <DueDateForm baby={props.baby} onUpdate={props.onUpdate} onClose={overlay.close} />
        </FormOverlayProvider>
      </PopoverContent>
    </Popover>
  );
}

function DueDateForm(props: EditorFormProps) {
  const { t } = useI18n();
  const dateCodec = htmlDate(t);
  const form = useZodForm({
    schema: dueDateSchema(t),
    defaultValues: {
      date: dateCodec.encode(props.baby.dueDate),
      showExactDueDate: props.baby.dueDateDisplayMode === "exact",
      publicDueDateText: props.baby.publicDueDateText ?? "",
    },
  });
  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        await props.onUpdate(values);
        props.onClose();
      }}
    >
      <DueDateDisplayFields
        control={form.control}
        dateFieldName="date"
        showExactDueDateFieldName="showExactDueDate"
        publicDueDateTextFieldName="publicDueDateText"
        className="mb-3"
        sectionLabelClassName={undefined}
        stopPopoverPropagation={true}
      />
      <EditorActions isBusy={false} />
    </Form>
  );
}

type StatusDateEditorProps = {
  baby: BabyData;
  status: Milestone;
  currentDate: string;
  onRedate: MilestoneRedateHandler;
  onRemove: MilestoneRemoveHandler;
};

function statusDateSchema(t: TranslationFunction, timeZone: string) {
  return z.object({ dateTime: htmlDateTime(t, timeZone) });
}

export function StatusDateEditor(props: StatusDateEditorProps) {
  const { t } = useI18n();
  const overlay = useFormOverlay({ onOpenChange: undefined });

  return (
    <Popover {...overlay.rootProps}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Clock className="w-4 h-4 mr-2" />
            {t("Edit")}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
        <FormOverlayProvider overlay={overlay}>
          <StatusDateForm
            baby={props.baby}
            status={props.status}
            currentDate={props.currentDate}
            onRedate={props.onRedate}
            onRemove={props.onRemove}
            onClose={overlay.close}
          />
        </FormOverlayProvider>
      </PopoverContent>
    </Popover>
  );
}

function StatusDateForm(props: {
  baby: BabyData;
  status: StatusDateEditorProps["status"];
  currentDate: string;
  onRedate: MilestoneRedateHandler;
  onRemove: MilestoneRemoveHandler;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const dateTimeCodec = htmlDateTime(t, props.baby.timeZone);
  const form = useZodForm({
    schema: statusDateSchema(t, props.baby.timeZone),
    defaultValues: { dateTime: dateTimeCodec.encode(props.currentDate) },
  });
  const deleteForm = useZodForm({
    schema: emptyActionSchema,
    defaultValues: {},
  });
  const { isSubmitting: isDeleting } = useFormState({ control: deleteForm.control });
  const blocker = getBlockingLaterMilestone(props.baby, props.status);
  const statusLabel = MILESTONE_LABELS[props.status];

  const deleteButton = (
    <Button type="button" variant="destructive" size="sm" disabled={Boolean(blocker)}>
      <Trash data-icon="inline-start" />
      {t("Delete")}
    </Button>
  );

  return (
    <>
      <Form
        form={deleteForm}
        handleSubmit={async () => {
          await props.onRemove(props.status);
          props.onClose();
        }}
      >
        {null}
      </Form>
      <Form
        form={form}
        handleSubmit={async (values) => {
          await props.onRedate(props.status, values.dateTime);
          props.onClose();
        }}
      >
        <FormField
          control={form.control}
          name="dateTime"
          render={({ field }) => (
            <FormItem className="mb-3">
              <FormControl>
                <Input
                  type="datetime-local"
                  aria-label={t("Status date and time")}
                  max={htmlDateTimeNow(props.baby.timeZone)}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-between gap-2">
          {blocker ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className="inline-flex"
                    aria-label={t("Delete the {{status}} status first", {
                      status: MILESTONE_LABELS[blocker],
                    })}
                  />
                }
              >
                {deleteButton}
              </TooltipTrigger>
              <TooltipContent>
                {t("Delete the {{status}} status first", { status: MILESTONE_LABELS[blocker] })}
              </TooltipContent>
            </Tooltip>
          ) : (
            <AlertDialog
              onOpenChange={(open, eventDetails) => {
                if (
                  shouldBlockOverlayDismiss({
                    isLocked: isDeleting,
                    open,
                    reason: eventDetails.reason,
                  })
                ) {
                  eventDetails.cancel();
                }
              }}
            >
              <AlertDialogTrigger render={deleteButton} />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("Delete {{status}} status?", { status: statusLabel })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      "This removes the status and deletes its timeline update, including any message or photo attached to it. This cannot be undone.",
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel render={<FormCancelButton form={deleteForm} />}>
                    {t("Cancel")}
                  </AlertDialogCancel>
                  <SubmitButton
                    form={deleteForm}
                    variant="destructive"
                    IconComponent={Trash}
                    iconPosition="start"
                  >
                    {t("Delete status")}
                  </SubmitButton>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <EditorActions isBusy={isDeleting} />
        </div>
      </Form>
    </>
  );
}

type NameEditorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

function nameSchema(t: TranslationFunction) {
  return z
    .object({
      name: z.string().trim().min(1, t("Name is required")),
    })
    .transform((values): Pick<BabyPatch, "name"> => values);
}

export function NameEditor(props: NameEditorProps) {
  const { t } = useI18n();
  const overlay = useFormOverlay({ onOpenChange: undefined });

  return (
    <Popover {...overlay.rootProps}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            {t("Edit")}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
        <FormOverlayProvider overlay={overlay}>
          <NameForm baby={props.baby} onUpdate={props.onUpdate} onClose={overlay.close} />
        </FormOverlayProvider>
      </PopoverContent>
    </Popover>
  );
}

function NameForm(props: EditorFormProps) {
  const { t } = useI18n();
  const form = useZodForm({
    schema: nameSchema(t),
    defaultValues: { name: props.baby.name },
  });

  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        await props.onUpdate(values);
        props.onClose();
      }}
    >
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem className="mb-3">
            <FormControl>
              <Input placeholder={t("Baby Name")} aria-label={t("Baby Name")} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <p className="text-xs text-muted-foreground mb-3">
        {t(
          "Renaming may change the page address, but links you have already shared will keep working.",
        )}
      </p>
      <EditorActions isBusy={false} />
    </Form>
  );
}

type JourneyEditorProps = {
  birthJourney: BirthJourney;
  onUpdate: BabyUpdateHandler;
};

function journeySchema() {
  return z
    .object({
      birthJourney: z.enum(BIRTH_JOURNEYS),
    })
    .transform((values): Pick<BabyPatch, "birthJourney"> => values);
}

export function JourneyEditor(props: JourneyEditorProps) {
  const { t } = useI18n();
  const overlay = useFormOverlay({ onOpenChange: undefined });

  return (
    <Popover {...overlay.rootProps}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" aria-label={t("Edit journey")}>
            {t("Edit")}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1rem)]">
        <FormOverlayProvider overlay={overlay}>
          <JourneyForm
            birthJourney={props.birthJourney}
            onUpdate={props.onUpdate}
            onClose={overlay.close}
          />
        </FormOverlayProvider>
      </PopoverContent>
    </Popover>
  );
}

function JourneyForm(props: {
  birthJourney: BirthJourney;
  onUpdate: BabyUpdateHandler;
  onClose: () => void;
}) {
  const form = useZodForm({
    schema: journeySchema(),
    defaultValues: { birthJourney: props.birthJourney },
  });
  const birthJourney = useWatch({ control: form.control, name: "birthJourney" });

  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        await props.onUpdate(values);
        props.onClose();
      }}
    >
      <div className="mb-3">
        <JourneyMilestoneEditor
          birthJourney={birthJourney}
          idPrefix="settings-journey"
          onBirthJourneyChange={(next) => {
            form.setValue("birthJourney", next, { shouldDirty: true, shouldTouch: true });
          }}
        />
      </div>
      <EditorActions isBusy={false} />
    </Form>
  );
}

type ThemeSelectorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

function ThemeSwatches(props: { colors: readonly string[] }) {
  return (
    <span className="flex gap-0.5">
      {props.colors.map((color, index) => (
        <span
          key={index}
          className="size-4 rounded-sm border border-border/50"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

export function ThemeSelector(props: ThemeSelectorProps) {
  const { t } = useI18n();
  const overlay = useFormOverlay({ onOpenChange: undefined });
  const selectedTheme = getThemeOption(props.baby.theme);
  const form = useZodForm({
    schema: z
      .object({
        theme: z.union([z.string(), z.null()]),
      })
      .transform((values): Pick<BabyPatch, "theme"> => values),
    defaultValues: { theme: props.baby.theme ?? null },
  });

  return (
    <Popover {...overlay.rootProps}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2" aria-label={t("Change theme")}>
            {selectedTheme ? (
              <>
                <ThemeSwatches colors={selectedTheme.colors} />
                {t(selectedTheme.labelKey)}
              </>
            ) : (
              t("Change")
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-56">
        <FormOverlayProvider overlay={overlay}>
          <Form
            form={form}
            handleSubmit={async (values) => {
              await props.onUpdate(values);
              overlay.close();
            }}
          >
            <div className="flex flex-col gap-1">
              {THEME_OPTIONS.map((option) => (
                <SubmitButton
                  key={option.value ?? "default"}
                  form="context"
                  variant={selectedTheme?.value === option.value ? "default" : "ghost"}
                  aria-pressed={selectedTheme?.value === option.value}
                  size="sm"
                  className="justify-start gap-2"
                  IconComponent={null}
                  iconPosition="start"
                  onClick={() => {
                    form.setValue("theme", option.value, { shouldDirty: true });
                  }}
                >
                  <ThemeSwatches colors={option.colors} />
                  {t(option.labelKey)}
                </SubmitButton>
              ))}
            </div>
          </Form>
        </FormOverlayProvider>
      </PopoverContent>
    </Popover>
  );
}
