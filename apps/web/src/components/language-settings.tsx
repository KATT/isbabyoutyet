import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
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
import { Form, useZodForm } from "@/components/Form";
import { LanguagePicker } from "@/components/language-picker";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import type { InitiatedConvexQuery, PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { DEFAULT_TIME_ZONE } from "@workspace/convex/src/timeZone";
import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { setLocale } from "@/lib/paraglide-setup";
import { cn } from "@workspace/ui/lib/utils";

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

type UpdateLocaleHandler = (
  args: FunctionArgs<typeof api.profile.updateLocale>,
) => Promise<unknown>;
type UpdateTimeZoneHandler = (
  args: FunctionArgs<typeof api.profile.updateTimeZone>,
) => Promise<unknown>;
type RequestLanguageHandler = (
  args: FunctionArgs<typeof api.profile.requestLanguage>,
) => Promise<unknown>;

function LanguageRequestForm(props: {
  onSaved: () => void;
  onRequestLanguage: RequestLanguageHandler;
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
        props.onSaved();
        toast.success(t("Language request saved"));
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
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {t("Send request")}
        </Button>
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
  profile:
    | PreloadedConvexQuery<typeof api.profile.get>
    | InitiatedConvexQuery<typeof api.profile.get>;
  className: string | undefined;
}) {
  const profileQuery = usePreloadedConvexQuery(api.profile.get, props.profile);
  const onUpdateLocale = useMutation(api.profile.updateLocale);
  const onUpdateTimeZone = useMutation(api.profile.updateTimeZone);
  const onRequestLanguage = useMutation(api.profile.requestLanguage);

  return (
    <LanguageSettingsView
      profile={profileQuery.data}
      className={props.className}
      onUpdateLocale={onUpdateLocale}
      onUpdateTimeZone={onUpdateTimeZone}
      onRequestLanguage={onRequestLanguage}
      onApplyLocale={setLocale}
    />
  );
}

/**
 * Presentational half of {@link LanguageSettings}: every side effect arrives as
 * a prop so tests can drive the pickers without a Convex deployment or a real
 * locale cookie reload.
 *
 * @internal exported for tests
 */
export function LanguageSettingsView(props: {
  profile: FunctionReturnType<typeof api.profile.get>;
  className: string | undefined;
  onUpdateLocale: UpdateLocaleHandler;
  onUpdateTimeZone: UpdateTimeZoneHandler;
  onRequestLanguage: RequestLanguageHandler;
  onApplyLocale: (locale: SupportedLocale) => Promise<void>;
}) {
  const { locale, t } = useI18n();
  const profile = props.profile;
  const updateTimeZone = props.onUpdateTimeZone;
  const [requestOpen, setRequestOpen] = useState(false);
  const selectedLocale = profile?.locale ?? locale;
  const selectedTimeZone = profile?.timeZone ?? DEFAULT_TIME_ZONE;
  const [selectedTimeZoneOption, setSelectedTimeZoneOption] = useState(
    () =>
      timeZoneOptions.find((option) => option.value === selectedTimeZone) ?? defaultTimeZoneOption,
  );

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", props.className)}>
      <Combobox
        items={timeZoneOptions}
        itemToStringValue={(option) => option.label}
        value={selectedTimeZoneOption}
        onValueChange={(option) => {
          if (!option || option.value === selectedTimeZoneOption.value) {
            return;
          }
          const previousOption = selectedTimeZoneOption;
          setSelectedTimeZoneOption(option);
          void updateTimeZone({ timeZone: option.value })
            .then(() => {
              toast.success(t("Time zone saved"));
            })
            .catch((error) => {
              setSelectedTimeZoneOption(previousOption);
              toast.error(error instanceof Error ? error.message : t("Failed to submit form"));
            });
        }}
        disabled={!profile}
      >
        <ComboboxInput
          className="w-56"
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

      <LanguagePicker
        value={selectedLocale}
        disabled={!profile}
        label={t("Profile language")}
        onValueChange={async (value) => {
          await props.onUpdateLocale({ locale: value });
          await props.onApplyLocale(value);
        }}
      />

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
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
          {requestOpen ? (
            <LanguageRequestForm
              onSaved={() => setRequestOpen(false)}
              onRequestLanguage={props.onRequestLanguage}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
