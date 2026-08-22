import { parseISO } from "date-fns";
import { BABY_BLUE_THEME } from "@workspace/convex/src/theme";
// Inline theme CSS (?raw) so we can inject via route `head.styles`.
// External `head.links` stylesheets get React 19 `precedence` via TanStack's
// Asset helper and can stay in the document after navigating away.
import violetBloomCss from "@/styles/themes/violet-bloom.css?raw";
import babyBlueCss from "@/styles/themes/baby-blue.css?raw";
import bubblegumCss from "@/styles/themes/bubblegum.css?raw";
import catppuccinCss from "@/styles/themes/catppuccin.css?raw";
import mochaMousseCss from "@/styles/themes/mocha-mousse.css?raw";
import quantumRoseCss from "@/styles/themes/quantum-rose.css?raw";
import sunnyDaysCss from "@/styles/themes/sunny-days.css?raw";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import type { TranslationKey } from "@/lib/i18n";

export const THEME_OPTIONS = [
  {
    value: null,
    labelKey: "Mango",
    colors: ["#ea580c", "#fef3c7", "#fed7aa"],
    css: null,
  }, // orange primary
  {
    value: "violet-bloom",
    labelKey: "Violet Bloom",
    css: violetBloomCss,
    colors: ["#7033ff", "#fdfdfd", "#e2ebff"],
  },
  {
    value: BABY_BLUE_THEME,
    labelKey: "Baby Blue",
    css: babyBlueCss,
    colors: ["#1e9df1", "#ffffff", "#e3ecf6"],
  },
  {
    value: "bubblegum",
    labelKey: "Bubblegum",
    css: bubblegumCss,
    colors: ["#d04f99", "#f6e6ee", "#fbe2a7"],
  },
  {
    value: "catppuccin",
    labelKey: "Catppuccin",
    css: catppuccinCss,
    colors: ["#8839ef", "#eff1f5", "#04a5e5"],
  },
  {
    value: "mocha-mousse",
    labelKey: "Mocha Mousse",
    css: mochaMousseCss,
    colors: ["#a37764", "#f1f0e5", "#e4c7b8"],
  },
  {
    value: "quantum-rose",
    labelKey: "Quantum Rose",
    css: quantumRoseCss,
    colors: ["#e6067a", "#fff0f8", "#ffc1e3"],
  },
  {
    value: "sunny-days",
    labelKey: "Sunny Days",
    css: sunnyDaysCss,
    colors: ["#f2a614", "#fff9e8", "#8ed1c5"],
  },
] as const satisfies ReadonlyArray<{
  value: string | null;
  labelKey: TranslationKey;
  colors: readonly string[];
  css: string | null;
}>;

export function getThemeOption(theme: string | null | undefined) {
  return THEME_OPTIONS.find((option) => option.value === (theme ?? null));
}

export function getThemeColors(theme: string | null | undefined) {
  return getThemeOption(theme)?.colors ?? THEME_OPTIONS[0].colors;
}

/** Raw CSS for a theme preset, or null for the default (app) theme. */
export function getThemeCss(theme: string | null | undefined): string | null {
  if (!theme) return null;
  return getThemeOption(theme)?.css ?? null;
}

export function getThemePrimaryColor(theme: string | null | undefined): string {
  return getThemeColors(theme)[0];
}

function parseDate(dateString: string): Date {
  return parseISO(dateString);
}

function parseCalendarDate(dateString: string): Date {
  const calendarDate = dateString.slice(0, 10);
  return new Date(`${calendarDate}T00:00:00.000Z`);
}

type DateTimeFormatOptions = {
  locale: SupportedLocale;
  timeZone: string;
};

export function formatDate(dateString: string, opts: DateTimeFormatOptions): string {
  const date = parseDate(dateString);
  const formatter = new Intl.DateTimeFormat(opts.locale, {
    timeZone: opts.timeZone,
    dateStyle: "long",
    timeStyle: "short",
  });
  return formatter.format(date);
}

export function getRelativeTime(dateString: string, locale: SupportedLocale): string {
  const date = parseDate(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const intervals = [
    { unit: "year" as const, seconds: 31536000 },
    { unit: "month" as const, seconds: 2592000 },
    { unit: "week" as const, seconds: 604800 },
    { unit: "day" as const, seconds: 86400 },
    { unit: "hour" as const, seconds: 3600 },
    { unit: "minute" as const, seconds: 60 },
  ];

  for (const { unit, seconds } of intervals) {
    const interval = Math.floor(Math.abs(diffInSeconds) / seconds);
    if (interval >= 1) {
      return rtf.format(diffInSeconds > 0 ? interval : -interval, unit);
    }
  }

  return rtf.format(0, "second");
}

export function formatDueDate(dateString: string, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    dateStyle: "long",
  }).format(parseCalendarDate(dateString));
}

function datePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    return null;
  }
  return {
    year: Number.parseInt(year),
    month: Number.parseInt(month),
    day: Number.parseInt(day),
  };
}

export function getDaysUntilDueDate(dueDate: string, timeZone: string): number {
  const now = new Date();
  const current = datePartsInTimeZone(now, timeZone);
  const due = datePartsInTimeZone(parseCalendarDate(dueDate), "UTC");
  if (!current || !due) {
    return 0;
  }
  const currentDate = Date.UTC(current.year, current.month - 1, current.day);
  const dueDateUtc = Date.UTC(due.year, due.month - 1, due.day);
  return Math.round((dueDateUtc - currentDate) / (1000 * 60 * 60 * 24));
}

export function getOverdueDays(dueDate: string, timeZone: string): number {
  const daysUntil = getDaysUntilDueDate(dueDate, timeZone);
  return Math.max(0, -daysUntil);
}
