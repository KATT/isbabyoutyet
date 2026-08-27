import type { SVGProps } from "react";
import * as stylex from "@stylexjs/stylex";
import { Button } from "@workspace/ui/components/button";
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { VisuallyHidden } from "@workspace/ui-patterns/components/visually-hidden";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Baby } from "@phosphor-icons/react";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { homepageDemoBabyFor } from "@workspace/convex/src/seedCredentials";
import { LanguagePicker } from "@/components/language-picker";
import { translate, useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import { homepageOgImagePath, openGraphImageMeta } from "@/lib/seo";
import { searchRobotsMeta } from "@/lib/robots";
import { absoluteUrl, canonicalUrl } from "@/lib/site-url";
import { setLocale } from "@/lib/paraglide-setup";
import { homepageCacheHeaders } from "@/lib/cachePolicy";
import { useClientDate } from "@/lib/use-client-date";
import { useRotatingIndex } from "@/lib/use-delayed-action";
import { useMeasuredWidth } from "@/lib/use-measured-width";

// Static date snapshot for SSR/hydration
// This ensures the same date is used on both server and client during hydration
const SERVER_DATE_SNAPSHOT = "2026-01-01T10:30:00.000Z";

const heroWordIn = stylex.keyframes({
  from: {
    opacity: 0,
    transform: "translateY(105%) rotate(6deg)",
  },
  to: {
    opacity: 1,
    transform: "translateY(0) rotate(0deg)",
  },
});

const heroWordOut = stylex.keyframes({
  from: {
    opacity: 1,
    transform: "translateY(0) rotate(0deg)",
  },
  to: {
    opacity: 0,
    transform: "translateY(-105%) rotate(-6deg)",
  },
});

const styles = stylex.create({
  page: {
    backgroundColor: colors.background,
    backgroundImage: `radial-gradient(color-mix(in oklab, ${colors.border} 80%, transparent) 1.5px, transparent 1.5px)`,
    backgroundSize: "22px 22px",
    minHeight: "100vh",
  },
  header: {
    paddingBottom: spacing.s1,
    paddingInline: spacing.s4,
    paddingTop: spacing.s3,
    position: "sticky",
    top: 0,
    zIndex: 20,
  },
  headerInner: {
    alignItems: "center",
    display: "flex",
    gap: spacing.s2,
    justifyContent: "space-between",
    marginInline: "auto",
    maxWidth: "64rem",
  },
  brandChip: {
    alignItems: "center",
    backdropFilter: "blur(12px)",
    backgroundColor: `color-mix(in oklab, ${colors.background} 85%, transparent)`,
    borderColor: colors.border,
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    display: "flex",
    gap: spacing.s2,
    paddingBottom: spacing.s1_5,
    paddingLeft: spacing.s2,
    paddingRight: spacing.s4,
    paddingTop: spacing.s1_5,
  },
  brandIcon: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    borderRadius: "9999px",
    color: colors.primary,
    display: "flex",
    height: "1.75rem",
    justifyContent: "center",
    width: "1.75rem",
  },
  brandName: {
    fontSize: "0.875rem",
    fontWeight: 800,
    letterSpacing: "-0.025em",
  },
  main: {
    marginInline: "auto",
    maxWidth: "64rem",
    paddingInline: spacing.s6,
  },
  hero: {
    paddingBlock: {
      "@media (min-width: 768px)": spacing.s16,
      default: "4rem",
    },
    textAlign: "center",
  },
  freeBadge: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 30%, transparent)`,
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
    color: colors.primary,
    display: "inline-block",
    fontSize: "0.875rem",
    fontWeight: 800,
    paddingBlock: spacing.s1_5,
    paddingInline: spacing.s4,
    transform: "rotate(-2deg)",
  },
  heroTitle: {
    color: colors.foreground,
    fontSize: {
      "@media (min-width: 768px)": "4.5rem",
      default: "3rem",
    },
    fontWeight: 900,
    letterSpacing: "-0.025em",
    lineHeight: {
      "@media (min-width: 768px)": 1,
      default: 1.1,
    },
    marginInline: "auto",
    marginTop: spacing.s8,
    maxWidth: "48rem",
    textWrap: "balance",
  },
  heroNamePill: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    borderRadius: "1.5rem",
    color: colors.primary,
    display: "inline-block",
    paddingInline: spacing.s4,
    transform: "rotate(-1deg)",
  },
  heroWordFrame: {
    display: "inline-block",
    overflow: "hidden",
    position: "relative",
    transitionDuration: "500ms",
    transitionProperty: "width",
    transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    whiteSpace: "nowrap",
    "@media (prefers-reduced-motion: reduce)": {
      transitionProperty: "none",
    },
  },
  heroWordIncoming: {
    animationDuration: "0.55s",
    animationFillMode: "both",
    animationName: heroWordIn,
    animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    display: "inline-block",
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
  },
  heroWordOutgoing: {
    animationDuration: "0.45s",
    animationFillMode: "both",
    animationName: heroWordOut,
    animationTimingFunction: "cubic-bezier(0.55, 0.055, 0.675, 0.19)",
    left: 0,
    position: "absolute",
    top: 0,
    "@media (prefers-reduced-motion: reduce)": {
      display: "none",
    },
  },
  heroLead: {
    color: colors.mutedForeground,
    fontSize: {
      "@media (min-width: 768px)": "1.25rem",
      default: "1.125rem",
    },
    fontWeight: 600,
    lineHeight: 1.625,
    marginInline: "auto",
    marginTop: spacing.s6,
    maxWidth: "42rem",
  },
  heroActions: {
    marginTop: spacing.s8,
  },
  section: {
    paddingBlock: spacing.s12,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: {
      "@media (min-width: 768px)": "2.25rem",
      default: "1.875rem",
    },
    fontWeight: 900,
    letterSpacing: "-0.025em",
    lineHeight: 1.15,
    margin: 0,
  },
  featureGrid: {
    display: "grid",
    gap: spacing.s5,
    marginTop: spacing.s10,
    "@media (min-width: 640px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (min-width: 1024px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
  },
  featureCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "1.5rem",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
    padding: spacing.s6,
    transitionDuration: "150ms",
    transitionProperty: "transform",
    transitionTimingFunction: "ease",
  },
  featureCardTiltLeft: {
    transform: {
      ":hover": "translateY(-0.25rem) rotate(-1deg)",
      default: null,
    },
  },
  featureCardTiltRight: {
    transform: {
      ":hover": "translateY(-0.25rem) rotate(1deg)",
      default: null,
    },
  },
  featureEmoji: {
    fontSize: "1.875rem",
    lineHeight: 1,
  },
  demoLink: {
    display: "block",
    marginTop: spacing.s10,
    textDecoration: "none",
  },
  demoCard: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 30%, transparent)`,
    borderRadius: "2rem",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `6px 6px 0 0 color-mix(in oklab, ${colors.primary} 30%, transparent)`,
    padding: {
      "@media (min-width: 768px)": spacing.s10,
      default: spacing.s8,
    },
    textAlign: "center",
    transform: {
      ":hover": "translateY(-0.25rem)",
      default: null,
    },
    transitionDuration: "150ms",
    transitionProperty: "transform",
    transitionTimingFunction: "ease",
  },
  demoEmoji: {
    fontSize: "3rem",
    lineHeight: 1,
  },
  previewIntro: {
    marginTop: spacing.s10,
  },
  previewGrid: {
    display: "grid",
    gap: spacing.s5,
    marginTop: spacing.s5,
    "@media (min-width: 640px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (min-width: 1024px)": {
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    },
  },
  previewLink: {
    display: "block",
    height: "100%",
    textDecoration: "none",
  },
  previewCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "1.5rem",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
    height: "100%",
    padding: spacing.s6,
    textAlign: "center",
    transitionDuration: "150ms",
    transitionProperty: "transform",
    transitionTimingFunction: "ease",
  },
  previewCardTiltLeft: {
    transform: {
      ":hover": "translateY(-0.25rem) rotate(-1deg)",
      default: null,
    },
  },
  previewCardTiltRight: {
    transform: {
      ":hover": "translateY(-0.25rem) rotate(1deg)",
      default: null,
    },
  },
  previewEmoji: {
    fontSize: "2.25rem",
    lineHeight: 1,
  },
  howGrid: {
    display: "grid",
    gap: spacing.s8,
    marginTop: spacing.s10,
    "@media (min-width: 768px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
  },
  howStep: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    textAlign: "center",
  },
  howBadge: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 30%, transparent)`,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
    color: colors.primary,
    display: "flex",
    fontSize: "1.5rem",
    fontWeight: 900,
    height: "3.5rem",
    justifyContent: "center",
    marginBottom: spacing.s4,
    transform: "rotate(-3deg)",
    width: "3.5rem",
  },
  ctaSection: {
    paddingBlock: "4rem",
    textAlign: "center",
  },
  ctaCard: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 25%, transparent)`,
    borderRadius: "2rem",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `6px 6px 0 0 color-mix(in oklab, ${colors.primary} 30%, transparent)`,
    marginInline: "auto",
    maxWidth: "42rem",
    paddingBlock: spacing.s12,
    paddingInline: spacing.s8,
  },
  ctaEmoji: {
    fontSize: "2.25rem",
    lineHeight: 1,
    margin: 0,
  },
  footer: {
    backgroundColor: `color-mix(in oklab, ${colors.background} 60%, transparent)`,
    borderTopColor: `color-mix(in oklab, ${colors.border} 60%, transparent)`,
    borderTopStyle: "solid",
    borderTopWidth: "2px",
    paddingBlock: spacing.s8,
    paddingInline: spacing.s4,
    textAlign: "center",
  },
  footerInner: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: spacing.s4,
    marginInline: "auto",
    maxWidth: "64rem",
  },
  githubLink: {
    alignItems: "center",
    color: {
      ":hover": colors.foreground,
      default: colors.mutedForeground,
    },
    display: "inline-flex",
    fontWeight: 700,
    gap: spacing.s2,
    textDecoration: "none",
    transitionDuration: "150ms",
    transitionProperty: "color",
    transitionTimingFunction: "ease",
  },
  githubIcon: {
    height: "1.25rem",
    width: "1.25rem",
  },
});

export const Route = createFileRoute("/")({
  component: HomePage,
  headers: homepageCacheHeaders,
  head: (opts) => {
    const locale = opts.match.context.locale;
    const title = translate(locale, "Is Baby Out Yet? – Share Your Baby's Arrival");
    const description = translate(
      locale,
      "Stop answering 'any news yet?' texts. Create a simple page to keep everyone updated, let them send encouragement, and notify them the moment baby arrives.",
    );
    const imageUrl = absoluteUrl(homepageOgImagePath());
    return {
      meta: [
        {
          title,
        },
        {
          name: "description",
          content: description,
        },
        {
          property: "og:title",
          content: title,
        },
        {
          property: "og:description",
          content: description,
        },
        {
          property: "og:url",
          content: canonicalUrl("/"),
        },
        {
          property: "og:type",
          content: "website",
        },
        ...openGraphImageMeta({ imageUrl, alt: title }),
        {
          name: "twitter:title",
          content: title,
        },
        {
          name: "twitter:description",
          content: description,
        },
        ...searchRobotsMeta({ index: true }),
      ],
      links: [{ rel: "canonical", href: canonicalUrl("/") }],
    };
  },
});

// lucide-react v1 removed brand icons (including Github), so inline the mark
function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...stylex.props(styles.githubIcon)}
      {...props}
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/**
 * Hero headline per locale. The highlighted slot cycles through the generic
 * "baby" word followed by popular local baby names. Words carry their own
 * article where the language needs one (pt-BR), so the sentence stays
 * grammatical for every name.
 */
const HERO_HEADLINES = {
  "en-GB": {
    before: "Is",
    after: "out yet?",
    words: ["baby", "Juniper", "Alfie", "Poppy", "Noah", "Ivy", "Oscar", "Freya"],
  },
  "en-US": {
    before: "Is",
    after: "out yet?",
    words: ["baby", "Willow", "Liam", "Olivia", "Wyatt", "Luna", "Ezra", "Hazel"],
  },
  sv: {
    before: "Har",
    after: "kommit?",
    words: ["bäbis", "Ella", "Hugo", "Astrid", "Nils", "Maja", "Sixten", "Vera"],
  },
  es: {
    before: "¿Ya nació",
    after: "o todavía no?",
    words: ["bebé", "Lucía", "Mateo", "Sofía", "Leo", "Valentina", "Martín", "Emma"],
  },
  "pt-BR": {
    before: "",
    after: "já nasceu?",
    words: [
      "O bebê",
      "A Helena",
      "O Miguel",
      "A Alice",
      "O Arthur",
      "A Laura",
      "O Theo",
      "A Cecília",
    ],
  },
} as const satisfies Record<
  SupportedLocale,
  { before: string; after: string; words: readonly string[] }
>;

const NAME_ROTATE_INTERVAL_MS = 2400;

function RotatingBabyName(props: { words: readonly string[] }) {
  const indices = useRotatingIndex({
    intervalMs: NAME_ROTATE_INTERVAL_MS,
    itemCount: props.words.length,
  });
  const [measureCurrentWord, width] = useMeasuredWidth();

  return (
    <span
      aria-hidden="true"
      {...stylex.props(styles.heroWordFrame)}
      style={width === null ? undefined : { width }}
    >
      {indices.previous !== null ? (
        <span
          key={`out-${indices.previous}-${indices.current}`}
          {...stylex.props(styles.heroWordOutgoing)}
        >
          {props.words[indices.previous]}
        </span>
      ) : null}
      <span
        key={`in-${indices.current}`}
        ref={measureCurrentWord}
        {...stylex.props(styles.heroWordIncoming)}
        data-hero-word="in"
      >
        {props.words[indices.current]}
      </span>
    </span>
  );
}

function useCurrentDate() {
  return useClientDate({ serverSnapshot: SERVER_DATE_SNAPSHOT });
}

const FEATURES = [
  {
    emoji: "📣",
    title: "Update your status",
    description:
      "One tap to update everyone — labour started, at the hospital, baby's here! No group texts, no repeated calls.",
  },
  {
    emoji: "📅",
    title: "Countdown to due date",
    description:
      'Everyone can see how many days are left — plus a friendly "overdue" counter when baby takes their time.',
  },
  {
    emoji: "🎨",
    title: "Make it yours",
    description:
      "Pick a theme that matches your style. From soft pastels to bold colours — your page, your vibe.",
  },
  {
    emoji: "🔗",
    title: "No account needed",
    description:
      "Anyone with the link can check in anytime. Grandma doesn't need to download an app or create an account.",
  },
  {
    emoji: "💌",
    title: "Send encouragement",
    description:
      "Visitors can leave messages of love and support. Like a digital guestbook filled with well-wishes you'll treasure.",
  },
  {
    emoji: "🔔",
    title: "Get notified",
    description:
      "Family can subscribe to push notifications and be the first to know the moment baby arrives.",
  },
] as const satisfies ReadonlyArray<{
  emoji: string;
  title: TranslationKey;
  description: TranslationKey;
}>;

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Create your page",
    description: "Sign up and add your baby's name and due date. That's it.",
  },
  {
    step: "2",
    title: "Share the link",
    description:
      "Send it to family and friends. They can check in anytime and subscribe for notifications.",
  },
  {
    step: "3",
    title: "Update as you go",
    description:
      "When things start happening, update your status. Everyone gets notified automatically.",
  },
] as const satisfies ReadonlyArray<{
  step: string;
  title: TranslationKey;
  description: TranslationKey;
}>;

type PreviewTilt = "left" | "right";

export function HomePage() {
  const { t, locale } = useI18n();
  const demoBaby = homepageDemoBabyFor(locale);
  const headline = HERO_HEADLINES[locale];
  const sessionData = authClient.useSession();

  const currentDate = useCurrentDate();

  // Helper to calculate dates with offsets for realistic demo scenarios
  const hoursAgo = (hours: number) => {
    const date = new Date(currentDate);
    date.setTime(date.getTime() - hours * 60 * 60 * 1000);
    return date.toISOString();
  };

  const previewStages = [
    {
      emoji: "👶",
      title: "Waiting",
      description: "Before labour starts",
      tilt: "left" as const satisfies PreviewTilt,
      search: { name: "Emma" },
    },
    {
      emoji: "💫",
      title: "Labour started",
      description: "Things are happening!",
      tilt: "right" as const satisfies PreviewTilt,
      search: { name: "Oliver", dueDate: hoursAgo(0), laborStarted: hoursAgo(2) },
    },
    {
      emoji: "🏥",
      title: "Gone to hospital",
      description: "Almost there!",
      tilt: "left" as const satisfies PreviewTilt,
      search: {
        name: "Sophia",
        laborStarted: hoursAgo(4),
        wentToHospital: hoursAgo(1),
        hospitalMessage: "We've made it in! More news when we have it 💕",
        theme: "bubblegum",
      },
    },
    {
      emoji: "🎉",
      title: "Baby born!",
      description: "Celebrate the arrival",
      tilt: "right" as const satisfies PreviewTilt,
      search: {
        name: "Liam",
        laborStarted: hoursAgo(6),
        wentToHospital: hoursAgo(3),
        babyBorn: hoursAgo(0.5),
        babyBornMessage: "Welcome to the world, little one! 🎉",
        theme: "sunny-days",
      },
    },
  ] as const;

  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.headerInner)}>
          <span {...stylex.props(styles.brandChip)}>
            <span {...stylex.props(styles.brandIcon)}>
              <Baby size={16} weight="bold" />
            </span>
            <span {...stylex.props(styles.brandName)}>isbabyoutyet</span>
          </span>
          <Inline gap="s2" wrap={false}>
            {sessionData.data ? (
              <Button
                size="sm"
                shape="pill"
                render={<Link to="/dashboard" />}
                nativeButton={false}
              >
                {t("Dashboard")}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  shape="pill"
                  variant="outline"
                  render={<Link to="/auth/login" />}
                  nativeButton={false}
                >
                  {t("Sign in")}
                </Button>
                <Button
                  size="sm"
                  shape="pill"
                  render={<Link to="/auth/signup" />}
                  nativeButton={false}
                >
                  {t("Get started")}
                </Button>
              </>
            )}
          </Inline>
        </div>
      </header>

      <main {...stylex.props(styles.main)}>
        <section {...stylex.props(styles.hero)}>
          <span {...stylex.props(styles.freeBadge)}>✨ {t("Free forever, no ads")}</span>
          <h1 {...stylex.props(styles.heroTitle)}>
            {headline.before === "" ? null : <>{headline.before} </>}
            <span {...stylex.props(styles.heroNamePill)}>
              <VisuallyHidden>{headline.words[0]}</VisuallyHidden>
              <RotatingBabyName words={headline.words} />
            </span>{" "}
            {headline.after}
          </h1>
          <p {...stylex.props(styles.heroLead)}>
            {t(
              'Stop answering "any news yet?" texts. Share one link, let everyone follow along, and tell them all at once when baby arrives. 🍼',
            )}
          </p>
          <div {...stylex.props(styles.heroActions)}>
            <Stack gap="s3" align="center">
              <Inline gap="s3" justify="center">
                {sessionData.data ? (
                  <Button
                    size="lg"
                    shape="pill"
                    render={<Link to="/dashboard" />}
                    nativeButton={false}
                  >
                    {t("Go to Dashboard")}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      shape="pill"
                      render={<Link to="/auth/signup" />}
                      nativeButton={false}
                    >
                      {t("Create your page 🎈")}
                    </Button>
                    <Button
                      size="lg"
                      shape="pill"
                      variant="outline"
                      render={<Link to="/auth/login" />}
                      nativeButton={false}
                    >
                      {t("Sign in")}
                    </Button>
                  </>
                )}
              </Inline>
              <Button
                size="lg"
                shape="pill"
                variant="secondary"
                render={<Link to="/baby/$publicId" params={{ publicId: demoBaby.publicId }} />}
                nativeButton={false}
              >
                {t("See a live page")} 👀
              </Button>
            </Stack>
          </div>
        </section>

        <section {...stylex.props(styles.section)}>
          <Stack gap="s2" align="center">
            <h2 {...stylex.props(styles.sectionTitle)}>{t("Everything the family needs")}</h2>
            <Text tone="muted" weight="semibold" align="center">
              {t("For you, and for everyone waiting by the phone")}
            </Text>
          </Stack>
          <div {...stylex.props(styles.featureGrid)}>
            {FEATURES.map((feature, index) => (
              <div
                key={feature.title}
                {...stylex.props(
                  styles.featureCard,
                  index % 2 === 0 ? styles.featureCardTiltLeft : styles.featureCardTiltRight,
                )}
              >
                <Stack gap="s3">
                  <span {...stylex.props(styles.featureEmoji)} aria-hidden="true">
                    {feature.emoji}
                  </span>
                  <Stack gap="s1_5">
                    <Text as="h3" size="lg" weight="extrabold">
                      {t(feature.title)}
                    </Text>
                    <Text as="p" size="sm" tone="muted" weight="medium">
                      {t(feature.description)}
                    </Text>
                  </Stack>
                </Stack>
              </div>
            ))}
          </div>
        </section>

        <section {...stylex.props(styles.section)}>
          <Stack gap="s2" align="center">
            <h2 {...stylex.props(styles.sectionTitle)}>{t("See it in action")}</h2>
            <Text tone="muted" weight="semibold" align="center">
              {t("{{name}}'s page is a live demo — leave a note, look around, try it out", {
                name: demoBaby.name,
              })}
            </Text>
          </Stack>
          <Link
            to="/baby/$publicId"
            params={{ publicId: demoBaby.publicId }}
            {...stylex.props(styles.demoLink)}
          >
            <div {...stylex.props(styles.demoCard)}>
              <Stack gap="s4" align="center">
                <span {...stylex.props(styles.demoEmoji)} aria-hidden="true">
                  🍼
                </span>
                <Stack gap="s2" align="center">
                  <Text as="h3" size="2xl" weight="black">
                    {t("Follow {{name}}'s arrival", { name: demoBaby.name })}
                  </Text>
                  <Text tone="muted" weight="medium" align="center">
                    {t(
                      "A live demo with a two-day labour story, photos, and messages. Send a test encouragement — this is the full experience.",
                    )}
                  </Text>
                </Stack>
                <Text size="sm" tone="primary" weight="extrabold">
                  {t("Open the live page →")}
                </Text>
              </Stack>
            </div>
          </Link>
          <div {...stylex.props(styles.previewIntro)}>
            <Text tone="muted" weight="semibold" align="center">
              {t("Or preview how each stage looks")}
            </Text>
          </div>
          <div {...stylex.props(styles.previewGrid)}>
            {previewStages.map((stage) => (
              <Link
                key={stage.title}
                to="/preview"
                search={stage.search}
                {...stylex.props(styles.previewLink)}
              >
                <div
                  {...stylex.props(
                    styles.previewCard,
                    stage.tilt === "left"
                      ? styles.previewCardTiltLeft
                      : styles.previewCardTiltRight,
                  )}
                >
                  <Stack gap="s3" align="center">
                    <span {...stylex.props(styles.previewEmoji)} aria-hidden="true">
                      {stage.emoji}
                    </span>
                    <Stack gap="s1" align="center">
                      <Text as="h3" weight="extrabold">
                        {t(stage.title)}
                      </Text>
                      <Text as="p" size="sm" tone="muted" weight="medium">
                        {t(stage.description)}
                      </Text>
                    </Stack>
                  </Stack>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section {...stylex.props(styles.section)}>
          <Stack gap="s2" align="center">
            <h2 {...stylex.props(styles.sectionTitle)}>{t("How it works")}</h2>
            <Text tone="muted" weight="semibold" align="center">
              {t("Up and running in under a minute")}
            </Text>
          </Stack>
          <div {...stylex.props(styles.howGrid)}>
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} {...stylex.props(styles.howStep)}>
                <div {...stylex.props(styles.howBadge)}>{item.step}</div>
                <Stack gap="s1_5" align="center">
                  <Text as="h3" size="lg" weight="extrabold">
                    {t(item.title)}
                  </Text>
                  <Text tone="muted" weight="medium" align="center">
                    {t(item.description)}
                  </Text>
                </Stack>
              </div>
            ))}
          </div>
        </section>

        <section {...stylex.props(styles.ctaSection)}>
          <div {...stylex.props(styles.ctaCard)}>
            <Stack gap="s4" align="center">
              <p {...stylex.props(styles.ctaEmoji)} aria-hidden="true">
                💖
              </p>
              <Stack gap="s3" align="center">
                <h2 {...stylex.props(styles.sectionTitle)}>{t("Ready to share the journey?")}</h2>
                <Text size="lg" tone="muted" weight="semibold" align="center">
                  {sessionData.data
                    ? t("Head back to your dashboard to keep everyone updated.")
                    : t(
                        "Join families who've already shared their special moments. Takes less than a minute.",
                      )}
                </Text>
              </Stack>
              {sessionData.data ? (
                <Button
                  size="lg"
                  shape="pill"
                  render={<Link to="/dashboard" />}
                  nativeButton={false}
                >
                  {t("Go to Dashboard")}
                </Button>
              ) : (
                <Button
                  size="lg"
                  shape="pill"
                  render={<Link to="/auth/signup" />}
                  nativeButton={false}
                >
                  {t("Get Started Free 🎉")}
                </Button>
              )}
            </Stack>
          </div>
        </section>
      </main>

      <footer {...stylex.props(styles.footer)}>
        <div {...stylex.props(styles.footerInner)}>
          <LanguagePicker
            value={locale}
            disabled={false}
            label={t("Language")}
            onValueChange={async (value) => {
              // Paraglide's configured cookie strategy persists explicit choices, then
              // reloads so SSR and the hydrated page use the same locale.
              await setLocale(value);
            }}
          />
          <a
            href="https://github.com/KATT/isbabyoutyet"
            target="_blank"
            rel="noopener noreferrer"
            {...stylex.props(styles.githubLink)}
          >
            <GithubIcon />
            <span>{t("Open source on GitHub")}</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
