import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Languages } from "lucide-react";
import { toast } from "sonner";
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
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { getLanguageName, useI18n } from "@/lib/i18n";
import { setLocale } from "@/paraglide/runtime";

export function LanguageSettings() {
  const { locale, t } = useI18n();
  const profile = useQuery(api.profile.get, {});
  const updateLocale = useMutation(api.profile.updateLocale);
  const requestLanguage = useMutation(api.profile.requestLanguage);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestedLocale, setRequestedLocale] = useState("");
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
          <Languages data-icon="inline-start" />
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
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await requestLanguage({ requestedLocale });
              setRequestedLocale("");
              setRequestOpen(false);
              toast.success(t("Language request saved"));
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="requested-language">{t("Language name or code")}</FieldLabel>
                <Input
                  id="requested-language"
                  value={requestedLocale}
                  onChange={(event) => setRequestedLocale(event.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                  placeholder={t("Example: French / fr-FR")}
                />
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={requestedLocale.trim().length < 2}>
                  {t("Send request")}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
