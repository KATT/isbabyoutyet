import { parseISO } from "date-fns";
import violetBloomCss from "@/styles/themes/violet-bloom.css?url";
import twitterCss from "@/styles/themes/twitter.css?url";
import bubblegumCss from "@/styles/themes/bubblegum.css?url";
import catppuccinCss from "@/styles/themes/catppuccin.css?url";
import mochaMousseCss from "@/styles/themes/mocha-mousse.css?url";
import quantumRoseCss from "@/styles/themes/quantum-rose.css?url";
import porcelainCss from "@/styles/themes/porcelain.css?url";

export const THEME_OPTIONS = [
  {
    value: null,
    label: "Default",
    colors: ["#ea580c", "#fef3c7", "#fed7aa"],
  }, // orange primary
  {
    value: "violet-bloom",
    label: "Violet Bloom",
    css: violetBloomCss,
    colors: ["#7033ff", "#fdfdfd", "#e2ebff"],
  },
  {
    value: "twitter",
    label: "Twitter Blue",
    css: twitterCss,
    colors: ["#1e9df1", "#ffffff", "#e3ecf6"],
  },
  {
    value: "bubblegum",
    label: "Bubblegum",
    css: bubblegumCss,
    colors: ["#d04f99", "#f6e6ee", "#fbe2a7"],
  },
  {
    value: "catppuccin",
    label: "Catppuccin",
    css: catppuccinCss,
    colors: ["#8839ef", "#eff1f5", "#04a5e5"],
  },
  {
    value: "mocha-mousse",
    label: "Mocha Mousse",
    css: mochaMousseCss,
    colors: ["#a37764", "#f1f0e5", "#e4c7b8"],
  },
  {
    value: "quantum-rose",
    label: "Quantum Rose",
    css: quantumRoseCss,
    colors: ["#e6067a", "#fff0f8", "#ffc1e3"],
  },
  {
    value: "porcelain",
    label: "Porcelain",
    css: porcelainCss,
    colors: ["#4f46e5", "#f7f7f8", "#e8eafd"],
  },
] as const;

const TIMEZONE = "Europe/Stockholm";

export function getThemeCssUrl(theme: string | null | undefined): string | null {
  if (!theme) return null;
  const option = THEME_OPTIONS.find((t) => t.value === theme);
  return option && "css" in option ? option.css : null;
}

export function getThemePrimaryColor(theme: string | null | undefined): string {
  const defaultColor = "#ea580c"; // Default orange primary
  if (!theme) return defaultColor;
  const option = THEME_OPTIONS.find((t) => t.value === theme);
  return option?.colors[0] ?? defaultColor;
}

export function parseDate(dateString: string): Date {
  return parseISO(dateString);
}

export function formatDate(dateString: string): string {
  const date = parseDate(dateString);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    dateStyle: "long",
    timeStyle: "short",
  });
  return formatter.format(date);
}

export function getRelativeTime(dateString: string): string {
  const date = parseDate(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

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

export function getDaysUntilDueDate(dueDate: string): number {
  const now = new Date();
  const due = parseDate(dueDate);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const nowParts = formatter.formatToParts(now);
  const currentYearPart = nowParts.find((p) => p.type === "year");
  const currentMonthPart = nowParts.find((p) => p.type === "month");
  const currentDayPart = nowParts.find((p) => p.type === "day");
  if (!currentYearPart || !currentMonthPart || !currentDayPart) {
    return 0;
  }
  const currentYear = parseInt(currentYearPart.value);
  const currentMonth = parseInt(currentMonthPart.value);
  const currentDay = parseInt(currentDayPart.value);

  const dueParts = formatter.formatToParts(due);
  const dueYearPart = dueParts.find((p) => p.type === "year");
  const dueMonthPart = dueParts.find((p) => p.type === "month");
  const dueDayPart = dueParts.find((p) => p.type === "day");
  if (!dueYearPart || !dueMonthPart || !dueDayPart) {
    return 0;
  }
  const dueYear = parseInt(dueYearPart.value);
  const dueMonth = parseInt(dueMonthPart.value);
  const dueDay = parseInt(dueDayPart.value);

  const currentDate = new Date(currentYear, currentMonth - 1, currentDay);
  const dueDateObj = new Date(dueYear, dueMonth - 1, dueDay);

  const diffInMs = dueDateObj.getTime() - currentDate.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  return diffInDays;
}

export function getOverdueDays(dueDate: string): number {
  const daysUntil = getDaysUntilDueDate(dueDate);
  return Math.max(0, -daysUntil);
}
