import { Form, useZodForm } from "@/components/Form";
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
import { Button } from "@workspace/ui/components/button";
import { FormControl, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { format, parseISO } from "date-fns";
import { Clock, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod";
import {
  getBlockingLaterMilestone,
  MILESTONE_FIELDS,
  MILESTONE_LABELS,
} from "@workspace/convex/src/types";
import type { BabyData, BabyUpdateHandler } from "@workspace/convex/src/types";
import { parseDate, THEME_OPTIONS } from "./utils";
import { useI18n } from "@/lib/i18n";

/** Format a date for a `datetime-local` input in the viewer's timezone. */
function toDatetimeLocalValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// The popover editors follow one pattern: the outer component owns the
// open state, the inner *Form component owns the form and is mounted fresh
// on every open — so defaultValues are always current and no reset is needed.

type EditorFormProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
  onClose: () => void;
};

function EditorActions(props: { onClose: () => void; isSubmitting: boolean; isDirty: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-2 justify-end">
      <Button
        type="button"
        onClick={props.onClose}
        variant="outline"
        size="sm"
        disabled={props.isSubmitting}
      >
        {t("Cancel")}
      </Button>
      <Button type="submit" size="sm" disabled={props.isSubmitting || !props.isDirty}>
        {t("Save")}
      </Button>
    </div>
  );
}

type DueDateEditorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

const dueDateSchema = z.object({
  date: z.string().min(1, "Pick a date"),
});

export function DueDateEditor({ baby, onUpdate }: DueDateEditorProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Popover
      open={isEditing}
      onOpenChange={(open, eventDetails) => {
        // Keep the popover open while the native date picker (rendered outside
        // the popover) is in use; Base UI replaces onInteractOutside with
        // onOpenChange reasons + eventDetails.cancel()
        if (
          !open &&
          (eventDetails.reason === "outside-press" || eventDetails.reason === "focus-out")
        ) {
          const activeElement = document.activeElement;
          if (
            activeElement?.tagName === "INPUT" &&
            (activeElement as HTMLInputElement).type === "date"
          ) {
            eventDetails.cancel();
            return;
          }
        }
        setIsEditing(open);
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            {t("Edit")}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
        <DueDateForm baby={baby} onUpdate={onUpdate} onClose={() => setIsEditing(false)} />
      </PopoverContent>
    </Popover>
  );
}

function DueDateForm(props: EditorFormProps) {
  const { t } = useI18n();
  const form = useZodForm({
    schema: dueDateSchema,
    defaultValues: { date: format(parseDate(props.baby.dueDate), "yyyy-MM-dd") },
  });

  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        await props.onUpdate({ dueDate: parseISO(values.date).toISOString() });
        props.onClose();
      }}
    >
      <FormField
        control={form.control}
        name="date"
        render={({ field }) => (
          <FormItem className="mb-3">
            <FormControl>
              <Input
                type="date"
                aria-label={t("Due Date")}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <EditorActions
        onClose={props.onClose}
        isSubmitting={form.formState.isSubmitting}
        isDirty={form.formState.isDirty}
      />
    </Form>
  );
}

type StatusDateEditorProps = {
  baby: BabyData;
  status: "labor_started" | "gone_to_hospital" | "born";
  currentDate: string;
  onUpdate: BabyUpdateHandler;
};

const statusDateSchema = z.object({
  dateTime: z.string().min(1, "Pick a date and time"),
});

export function StatusDateEditor(props: StatusDateEditorProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Clock className="w-4 h-4 mr-2" />
            {t("Edit")}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
        <StatusDateForm
          baby={props.baby}
          status={props.status}
          currentDate={props.currentDate}
          onUpdate={props.onUpdate}
          onClose={() => setIsEditing(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

function StatusDateForm(props: {
  baby: BabyData;
  status: StatusDateEditorProps["status"];
  currentDate: string;
  onUpdate: BabyUpdateHandler;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);
  const form = useZodForm({
    schema: statusDateSchema,
    defaultValues: { dateTime: toDatetimeLocalValue(parseDate(props.currentDate)) },
  });
  const blocker = getBlockingLaterMilestone(props.baby, props.status);
  const statusLabel = MILESTONE_LABELS[props.status];

  const deleteButton = (
    <Button type="button" variant="destructive" size="sm" disabled={Boolean(blocker)}>
      <Trash data-icon="inline-start" />
      {t("Delete")}
    </Button>
  );

  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        const dateString = parseISO(values.dateTime).toISOString();
        if (props.status === "labor_started") {
          await props.onUpdate({ laborStarted: dateString });
        } else if (props.status === "gone_to_hospital") {
          await props.onUpdate({ wentToHospital: dateString });
        } else {
          await props.onUpdate({ babyBorn: dateString });
        }
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
                max={toDatetimeLocalValue(new Date())}
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
          <AlertDialog>
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
                <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await props.onUpdate({ [MILESTONE_FIELDS[props.status].date]: null });
                      props.onClose();
                    } catch {
                      toast.error(
                        t("Could not delete the {{status}} status", { status: statusLabel }),
                      );
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                >
                  {t("Delete status")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <EditorActions
          onClose={props.onClose}
          isSubmitting={form.formState.isSubmitting || isDeleting}
          isDirty={form.formState.isDirty}
        />
      </div>
    </Form>
  );
}

type NameEditorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

const nameSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

export function NameEditor({ baby, onUpdate }: NameEditorProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            {t("Edit")}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
        <NameForm baby={baby} onUpdate={onUpdate} onClose={() => setIsEditing(false)} />
      </PopoverContent>
    </Popover>
  );
}

function NameForm(props: EditorFormProps) {
  const { t } = useI18n();
  const form = useZodForm({
    schema: nameSchema,
    defaultValues: { name: props.baby.name },
  });

  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        await props.onUpdate({ name: values.name.trim() });
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
      <EditorActions
        onClose={props.onClose}
        isSubmitting={form.formState.isSubmitting}
        isDirty={form.formState.isDirty}
      />
    </Form>
  );
}

type ThemeSelectorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

export function ThemeSelector({ baby, onUpdate }: ThemeSelectorProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            {t("Change")}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-56">
        <div className="flex flex-col gap-1">
          {THEME_OPTIONS.map((option) => (
            <Button
              key={option.value ?? "default"}
              variant={baby.theme === option.value ? "default" : "ghost"}
              size="sm"
              className="justify-start gap-2"
              disabled={isLoading}
              onClick={async () => {
                setIsLoading(true);
                try {
                  await onUpdate({ theme: option.value });
                  setIsOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to update theme");
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              <div className="flex gap-0.5">
                {option.colors.map((color, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-sm border border-border/50"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              {t(option.labelKey)}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
