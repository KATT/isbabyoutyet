import { Translate } from "@phosphor-icons/react";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@workspace/convex/src/i18n";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { getLanguageName } from "@/lib/i18n";

type LanguagePickerProps = {
  disabled: boolean;
  label: string;
  onValueChange: (locale: SupportedLocale) => Promise<void>;
  value: SupportedLocale;
};

export function LanguagePicker(props: LanguagePickerProps) {
  return (
    <Select
      value={props.value}
      onValueChange={(value) => {
        if (!value || !isSupportedLocale(value) || value === props.value) {
          return;
        }
        void props.onValueChange(value);
      }}
      disabled={props.disabled}
    >
      <SelectTrigger aria-label={props.label}>
        <Translate data-icon="inline-start" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {SUPPORTED_LOCALES.map((supportedLocale) => (
            <SelectItem key={supportedLocale} value={supportedLocale}>
              {getLanguageName(supportedLocale, props.value)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
