import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { Translate } from "@phosphor-icons/react";
import { toast } from "sonner";
import * as z from "zod";
import { api } from "@workspace/convex/convex/_generated/api";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@workspace/convex/src/i18n";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Form, useZodForm } from "@/components/Form";
import type { TranslationFunction } from "@/lib/i18n";
import { getLanguageName, useI18n } from "@/lib/i18n";
import { setLocale } from "@/paraglide/runtime";

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

function LanguageRequestForm(props: { onSaved: () => void }) {
  const { t } = useI18n();
  const requestLanguage = useMutation(api.profile.requestLanguage);
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
              <Input
                maxLength={100}
                placeholder={t("Example: French / fr-FR")}
                {...field}
              />
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

export function LanguageSettings() {
  const { locale, t } = useI18n();
  const profile = useQuery(api.profile.get, {});
  const updateLocale = useMutation(api.profile.updateLocale);
  const [requestOpen, setRequestOpen] = useState(false);
  const selectedLocale = profile?.locale ?? locale;

  async function selectLocale(value: string | null) {
    if (!value || !isSupportedLocale(value) || value === selectedLocale) {
      return;
    }
    await updateLocale({ locale: value });
    await setLocale(value);
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedLocale}
        onValueChange={(value) => void selectLocale(value)}
        disabled={!profile}
      >
        <SelectTrigger aria-label={t("Profile language")}>
          <Translate data-icon="inline-start" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {SUPPORTED_LOCALES.map((supportedLocale) => (
              <SelectItem key={supportedLocale} value={supportedLocale}>
                {getLanguageName(supportedLocale, locale)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

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
          {requestOpen ? <LanguageRequestForm onSaved={() => setRequestOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
