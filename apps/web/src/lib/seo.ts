import type { BabyStatus, BirthJourney, MilestoneVisibility } from "@workspace/convex/src/types";
import { getCurrentStatus, isPlannedDateJourney } from "@workspace/convex/src/types";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { getDaysUntilDueDate, getOverdueDays, getThemePrimaryColor } from "@/components/baby/utils";
import { translate } from "@/lib/i18n";
import { isIndexableBabyPublicId, searchRobotsMeta } from "@/lib/robots";
import { absoluteUrl, canonicalUrl } from "@/lib/site-url";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

type BabySeoInput = {
  name: string;
  dueDate: string;
  publicId: string;
  theme: string | null | undefined;
  locale: SupportedLocale;
  babyBorn: string | null | undefined;
  wentToHospital: string | null | undefined;
  laborStarted: string | null | undefined;
} & Partial<{
  birthJourney: BirthJourney | null;
  milestoneVisibility: MilestoneVisibility | null;
}>;

function babyPageTitle(baby: BabySeoInput) {
  const overdueDays = getOverdueDays(baby.dueDate);
  const daysUntilDueDate = getDaysUntilDueDate(baby.dueDate);
  const isBorn = !!baby.babyBorn;
  const locale = baby.locale;
  const plannedDateCopy = isPlannedDateJourney(baby);

  let title = translate(locale, "Is {{name}} out yet?", { name: baby.name });
  if (!isBorn) {
    if (plannedDateCopy && overdueDays > 0) {
      title = translate(
        locale,
        overdueDays === 1
          ? "Planned date was {{count}} day ago – Is {{name}} out yet?"
          : "Planned date was {{count}} days ago – Is {{name}} out yet?",
        { count: overdueDays, name: baby.name },
      );
    } else if (plannedDateCopy) {
      title = translate(
        locale,
        daysUntilDueDate === 1
          ? "{{count}} day to go – Is {{name}} out yet?"
          : "{{count}} days to go – Is {{name}} out yet?",
        { count: daysUntilDueDate, name: baby.name },
      );
    } else if (overdueDays > 0) {
      title = translate(
        locale,
        overdueDays === 1
          ? "{{count}} day overdue – Is {{name}} out yet?"
          : "{{count}} days overdue – Is {{name}} out yet?",
        { count: overdueDays, name: baby.name },
      );
    } else {
      title = translate(
        locale,
        daysUntilDueDate === 1
          ? "{{count}} day until due date – Is {{name}} out yet?"
          : "{{count}} days until due date – Is {{name}} out yet?",
        { count: daysUntilDueDate, name: baby.name },
      );
    }
  }
  return translate(locale, "{{title}} – Track Your Baby's Journey", { title });
}

export function babyPageDescription(baby: BabySeoInput) {
  const status = getCurrentStatus(baby);
  const locale = baby.locale;
  const plannedDateCopy = isPlannedDateJourney(baby);
  switch (status.type) {
    case "born":
      return translate(locale, "{{name}} has arrived! See the announcement and follow along.", {
        name: baby.name,
      });
    case "gone_to_hospital":
      return plannedDateCopy
        ? translate(
            locale,
            "{{name}}'s family is at hospital — follow live updates on the baby page.",
            { name: baby.name },
          )
        : translate(
            locale,
            "{{name}}'s family has gone to hospital — follow live updates on the baby page.",
            { name: baby.name },
          );
    case "labor_started":
      return translate(
        locale,
        "{{name}}'s labour has started — follow live updates on the baby page.",
        { name: baby.name },
      );
    case "not_yet":
      return plannedDateCopy
        ? translate(locale, "{{name}}'s big day is planned — follow the countdown and updates.", {
            name: baby.name,
          })
        : translate(locale, "Track {{name}}'s journey – know when baby arrives!", {
            name: baby.name,
          });
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function babyStatusLabel(
  opts: {
    status: BabyStatus;
    locale: SupportedLocale;
  } & Partial<{
    birthJourney: BirthJourney | null;
    milestoneVisibility: MilestoneVisibility | null;
  }>,
) {
  const plannedDateCopy = isPlannedDateJourney(opts);
  switch (opts.status.type) {
    case "born":
      return translate(opts.locale, "Yes! Baby is out");
    case "gone_to_hospital":
      return translate(opts.locale, plannedDateCopy ? "At hospital" : "Gone to hospital");
    case "labor_started":
      return translate(opts.locale, "Labour started");
    case "not_yet":
      return translate(opts.locale, plannedDateCopy ? "The big day is planned" : "Not yet");
    default: {
      const _exhaustive: never = opts.status;
      return _exhaustive;
    }
  }
}

export function babyStatusDetail(opts: {
  baby: Pick<
    BabySeoInput,
    "dueDate" | "babyBorn" | "locale" | "birthJourney" | "milestoneVisibility"
  >;
  status: BabyStatus;
}) {
  const locale = opts.baby.locale;
  const plannedDateCopy = isPlannedDateJourney(opts.baby);
  if (opts.status.type === "born") {
    return translate(locale, "Yes! Baby is out");
  }
  if (opts.status.type !== "not_yet") {
    return babyStatusLabel({
      status: opts.status,
      locale,
      milestoneVisibility: opts.baby.milestoneVisibility,
      birthJourney: opts.baby.birthJourney,
    });
  }
  const overdueDays = getOverdueDays(opts.baby.dueDate);
  if (plannedDateCopy && overdueDays > 0) {
    return translate(
      locale,
      overdueDays === 1
        ? "Scheduled date was {{count}} day ago"
        : "Scheduled date was {{count}} days ago",
      { count: overdueDays },
    );
  }
  const daysUntil = getDaysUntilDueDate(opts.baby.dueDate);
  if (plannedDateCopy) {
    if (daysUntil === 0) {
      return translate(locale, "The big day is today!");
    }
    return translate(locale, daysUntil === 1 ? "{{count}} day to go" : "{{count}} days to go", {
      count: daysUntil,
    });
  }
  if (overdueDays > 0) {
    return translate(
      locale,
      overdueDays === 1 ? "{{count}} day overdue" : "{{count}} days overdue",
      { count: overdueDays },
    );
  }
  return translate(
    locale,
    daysUntil === 1 ? "{{count}} day until due date" : "{{count}} days until due date",
    { count: daysUntil },
  );
}

function babyOgImagePath(publicId: string) {
  return `/og/baby/${publicId}`;
}

export function homepageOgImagePath() {
  return "/og";
}

export function openGraphImageMeta(opts: { imageUrl: string; alt: string }) {
  return [
    { property: "og:image", content: opts.imageUrl },
    { property: "og:image:width", content: String(OG_IMAGE_WIDTH) },
    { property: "og:image:height", content: String(OG_IMAGE_HEIGHT) },
    { property: "og:image:alt", content: opts.alt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: opts.imageUrl },
    { name: "twitter:image:alt", content: opts.alt },
  ];
}

export function babySeoHead(baby: BabySeoInput) {
  const title = babyPageTitle(baby);
  const description = babyPageDescription(baby);
  const pagePath = `/baby/${baby.publicId}`;
  const imageUrl = absoluteUrl(babyOgImagePath(baby.publicId));
  const themeColor = getThemePrimaryColor(baby.theme);

  return {
    title,
    description,
    themeColor,
    canonical: canonicalUrl(pagePath),
    ogUrl: canonicalUrl(pagePath),
    imageUrl,
    imageAlt: title,
    locale: baby.locale,
    indexable: isIndexableBabyPublicId(baby.publicId),
  };
}

export function robotsNoIndexMeta() {
  return searchRobotsMeta({ index: false });
}
