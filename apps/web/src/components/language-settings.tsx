import { useRef } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { toast } from "sonner";
import * as z from "zod";
import { api } from "@workspace/convex/convex/_generated/api";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import type { DialogActions } from "@workspace/ui/components/dialog";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox";
import { Form, SubmitButton, useZodForm } from "@/components/Form";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { LanguagePicker } from "@/components/language-picker";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { DEFAULT_TIME_ZONE } from "@workspace/convex/src/timeZone";
import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { setLocale } from "@/lib/paraglide-setup";
import { useOptimisticOverride } from "@/lib/use-optimistic-override";
import * as stylex from "@stylexjs/stylex";
import { Inline } from "@workspace/ui-patterns/components/inline";
import type { StackJustify } from "@workspace/ui-patterns/components/stack";

const styles = stylex.create({
  timeZoneField: {
    width: "14rem",
  },
});

function languageRequestSchema(t: TranslationFunction) {
  return z
    .object({
      requestedLocale: z
        .string()
        .trim()
        .min(2, t("Enter a language name or language code"))
        .max(100),
    })
    .transform((values): FunctionArgs<typeof api.profile.requestLanguage> => values);
}

type RequestLanguageHandler = (
  args: FunctionArgs<typeof api.profile.requestLanguage>,
) => Promise<unknown>;

function LanguageRequestForm(props: {
  onRequestLanguage: RequestLanguageHandler;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const requestLanguage = props.onRequestLanguage;
  const form = useZodForm({
    schema: languageRequestSchema(t),
    defaultValues: { requestedLocale: "" },
  });

  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        await requestLanguage(values);
        form.reset({ requestedLocale: "" });
        toast.success(t("Language request saved"));
        props.onClose();
      }}
    >
      <FormField
        control={form.control}
        name="requestedLocale"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("Language name or code")}</FormLabel>
            <FormControl>
              <Input maxLength={100} placeholder={t("Example: French / fr-FR")} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <DialogFooter>
        <SubmitButton form="context" IconComponent={PaperPlaneTilt} iconPosition="start">
          {t("Send request")}
        </SubmitButton>
      </DialogFooter>
    </Form>
  );
}

function formatTimeZoneLabel(timeZone: string) {
  const [firstPart, ...locationParts] = timeZone.split("/");
  const area = firstPart ?? timeZone;
  const location = locationParts.join(" / ").replaceAll("_", " ");
  return location ? `${location} (${area})` : area;
}

const timeZoneOptions = Array.from(
  new Set([DEFAULT_TIME_ZONE, ...Intl.supportedValuesOf("timeZone")]),
)
  .toSorted()
  .map((timeZone) => ({
    label: formatTimeZoneLabel(timeZone),
    value: timeZone,
  }));

const defaultTimeZoneOption = {
  label: formatTimeZoneLabel(DEFAULT_TIME_ZONE),
  value: DEFAULT_TIME_ZONE,
};

export function LanguageSettings(props: {
  profile: PreloadedConvexQuery<typeof api.profile.get>;
  justify: StackJustify | undefined;
}) {
  const profileQuery = usePreloadedConvexQuery(api.profile.get, props.profile);
  const onUpdateLocale = useMutation(api.profile.updateLocale);
  const onUpdateTimeZone = useMutation(api.profile.updateTimeZone);
  const onRequestLanguage = useMutation(api.profile.requestLanguage);
  const { locale, t } = useI18n();
  const profile = profileQuery.data;
  const selectedLocale = profile?.locale ?? locale;
  const selectedTimeZone = profile?.timeZone ?? DEFAULT_TIME_ZONE;
  const [optimisticTimeZone, setOptimisticTimeZone] = useOptimisticOverride({
    base: selectedTimeZone,
    isEqual: (left, right) => left === right,
  });
  const selectedTimeZoneOption =
    timeZoneOptions.find((option) => option.value === optimisticTimeZone) ?? defaultTimeZoneOption;
  const languageRequestActionsRef = useRef<DialogActions | null>(null);

  return (
    <Inline gap="s2" justify={props.justify ?? "center"} align="center">
      <div {...stylex.props(styles.timeZoneField)}>
        <Combobox
          items={timeZoneOptions}
          itemToStringValue={(option) => option.label}
          value={selectedTimeZoneOption}
          onValueChange={(option) => {
            if (!option || option.value === optimisticTimeZone) {
              return;
            }
            const previousTimeZone = optimisticTimeZone;
            setOptimisticTimeZone(option.value);
            void onUpdateTimeZone({ timeZone: option.value })
              .then(() => {
                toast.success(t("Time zone saved"));
              })
              .catch((error) => {
                setOptimisticTimeZone(previousTimeZone);
                toast.error(error instanceof Error ? error.message : t("Failed to submit form"));
              });
          }}
          disabled={!profile}
        >
          <ComboboxInput
            aria-label={t("Profile time zone")}
            placeholder={t("Search time zones")}
            onFocus={(event) => {
              event.currentTarget.select();
            }}
          />
          <ComboboxContent>
            <ComboboxEmpty>{t("No time zones found")}</ComboboxEmpty>
            <ComboboxList>
              {(option) => (
                <ComboboxItem key={option.value} value={option}>
                  {option.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      <LanguagePicker
        value={selectedLocale}
        disabled={!profile}
        label={t("Profile language")}
        onValueChange={async (value) => {
          await onUpdateLocale({ locale: value });
          await setLocale(value);
        }}
      />

      <Dialog actionsRef={languageRequestActionsRef}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm">
              {t("Request another language")}
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Request another language")}</DialogTitle>
            <DialogDescription>
              {t("Tell us which language you would like us to add.")}
            </DialogDescription>
          </DialogHeader>
          <LanguageRequestForm
            onRequestLanguage={onRequestLanguage}
            onClose={() => {
              languageRequestActionsRef.current?.close();
            }}
          />
        </DialogContent>
      </Dialog>
    </Inline>
  );
}
