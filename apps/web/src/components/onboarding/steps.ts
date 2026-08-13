import type { OnboardingStepId } from "@workspace/convex/src/onboardingSteps";
import type { Icon } from "@phosphor-icons/react";
import { Baby, ChatCircleText, GearSix, Heart, ShareNetwork } from "@phosphor-icons/react";

export type OnboardingStepCopy = {
  id: OnboardingStepId;
  title: string;
  description: string;
  /** Where the tip makes the most sense */
  surface: "dashboard" | "baby" | "any";
  /** Matches `data-tour-id` on the UI target */
  targetId: string;
  icon: Icon;
  ctaLabel?: string;
};

export const ONBOARDING_STEPS: OnboardingStepCopy[] = [
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
  },
  {
    id: "post_update",
    title: "Post an update",
    description:
      "When something changes, post it. Loved ones see the status and can subscribe for push alerts.",
    surface: "baby",
    targetId: "post_update",
    icon: ChatCircleText,
  },
  {
    id: "explore_settings",
    title: "Peek at settings",
    description: "Themes, names, and whether visitors can leave encouragements — all in Settings.",
    surface: "baby",
    targetId: "explore_settings",
    icon: GearSix,
  },
  {
    id: "learn_encouragements",
    title: "Encouragements from visitors",
    description:
      "Anyone with the link can leave a short supportive note — no account needed. They show up in your timeline.",
    surface: "baby",
    targetId: "learn_encouragements",
    icon: Heart,
  },
];

export type WelcomeSlide = {
  title: string;
  body: string;
  icon: Icon;
};

export const WELCOME_SLIDES: WelcomeSlide[] = [
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
    body: "Post milestones and messages from the nav. Visitors can subscribe for notifications and leave encouragements.",
    icon: ChatCircleText,
  },
  {
    title: "Skip anytime",
    body: "We'll nudge you through the first few steps with a tiny checklist. Dismiss it whenever — you can restart from the dashboard.",
    icon: Heart,
  },
];
