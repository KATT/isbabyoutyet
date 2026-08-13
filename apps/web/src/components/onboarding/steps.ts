import type { OnboardingStepId } from "@workspace/convex/src/onboardingSteps";
import type { Icon } from "@phosphor-icons/react";
import { Baby, ChatCircleText, GearSix, Heart, ShareNetwork } from "@phosphor-icons/react";
import type { TranslationKey } from "@/lib/i18n";

export type OnboardingStepCopy = {
  id: OnboardingStepId;
  title: TranslationKey;
  description: TranslationKey;
  /** Where the tip makes the most sense */
  surface: "dashboard" | "baby" | "any";
  /** Matches `data-tour-id` on the UI target */
  targetId: string;
  icon: Icon;
  ctaLabel: TranslationKey | undefined;
};

export const ONBOARDING_STEPS = [
  {
    id: "add_baby",
    title: "Add your first baby",
    description: "Give them a name and due date — that creates a public page friends can open.",
    surface: "dashboard",
    targetId: "add_baby",
    icon: Baby,
    ctaLabel: "Add a baby",
  },
  {
    id: "share_link",
    title: "Share the link",
    description:
      "One link for everyone. Tap Share on the baby page to copy it — no group chat spam.",
    surface: "baby",
    targetId: "share_link",
    icon: ShareNetwork,
    ctaLabel: undefined,
  },
  {
    id: "post_update",
    title: "Post an update",
    description:
      "Post milestones and everyday notes from the nav. Push notifications only go to people who subscribed — and only when you mark a status update (labour, hospital, or born).",
    surface: "baby",
    targetId: "post_update",
    icon: ChatCircleText,
    ctaLabel: undefined,
  },
  {
    id: "explore_settings",
    title: "Peek at settings",
    description: "Themes, names, and whether visitors can leave encouragements — all in Settings.",
    surface: "baby",
    targetId: "explore_settings",
    icon: GearSix,
    ctaLabel: undefined,
  },
  {
    id: "learn_encouragements",
    title: "Encouragements from visitors",
    description:
      "Anyone with the link can leave a short supportive note — no account needed. They show up in your timeline.",
    surface: "baby",
    targetId: "learn_encouragements",
    icon: Heart,
    ctaLabel: undefined,
  },
] as const satisfies ReadonlyArray<OnboardingStepCopy>;

export type WelcomeSlide = {
  title: TranslationKey;
  body: TranslationKey;
  icon: Icon;
};

export const WELCOME_SLIDES = [
  {
    title: "Welcome — here's the idea",
    body: "Is Baby Out Yet gives you one calm page for labour updates, so friends and family stop texting you for news.",
    icon: Baby,
  },
  {
    title: "Create a baby page",
    body: "Add a name and due date. You get a shareable link like isbabyoutyet.com/baby/… that shows the current status.",
    icon: ShareNetwork,
  },
  {
    title: "Share once, update as you go",
    body: "Post milestones and messages from the nav. Status updates notify subscribers; everyday notes and encouragements stay quiet.",
    icon: ChatCircleText,
  },
  {
    title: "Skip anytime",
    body: "A tiny checklist follows you around. Tap a step to jump there or highlight the control. Dismiss whenever — restart from the dashboard sparkle.",
    icon: Heart,
  },
] as const satisfies ReadonlyArray<WelcomeSlide>;

export const DEMO_WELCOME_SLIDES = [
  {
    title: "Welcome to the demo playground",
    body: "Explore the same page controls a parent uses, including themes, dates, names, and encouragement settings.",
    icon: Baby,
  },
  {
    title: "Your own safe copy",
    body: "The first setting you change creates a private playground copy for this browser. The seeded demo stays unchanged.",
    icon: GearSix,
  },
  {
    title: "It disappears automatically",
    body: "Your playground and its copied messages are removed four days after your last change.",
    icon: Heart,
  },
  {
    title: "Make it real when you're ready",
    body: "Create a free account to make a permanent baby page you can share with family and friends.",
    icon: ShareNetwork,
  },
] as const satisfies ReadonlyArray<WelcomeSlide>;
