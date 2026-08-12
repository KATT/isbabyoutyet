import { Button } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import { AppHeader } from "@/components/baby/app-header";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Baby,
  Bell,
  Calendar,
  Check,
  CheckCircle,
  Hospital,
  Link2,
  MessageCircleHeart,
  Palette,
} from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";

// Static date snapshot for SSR/hydration
// This ensures the same date is used on both server and client during hydration
const SERVER_DATE_SNAPSHOT = "2026-01-01T10:30:00.000Z";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      {
        title: "Is Baby Out Yet? - Share Your Baby's Arrival",
      },
      {
        name: "description",
        content:
          "Stop answering 'any news yet?' texts. Create a simple page to keep everyone updated, let them send encouragement, and notify them the moment baby arrives.",
      },
    ],
  }),
});

// lucide-react v1 removed brand icons (including Github), so inline the mark
function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function useCurrentDate() {
  const clientDate = useMemo(() => new Date().toISOString(), []);
  return useSyncExternalStore<string>(
    () => () => {}, // No-op subscribe for demo dates
    () => clientDate, // Client snapshot (cached)
    () => SERVER_DATE_SNAPSHOT, // Server snapshot for SSR/hydration
  );
}

const FEATURES = [
  {
    icon: Baby,
    title: "One-tap status updates",
    description:
      "Labour started, at the hospital, baby's here — everyone finds out at once. No group texts, no repeated calls.",
  },
  {
    icon: Calendar,
    title: "Due-date countdown",
    description:
      'Days remaining at a glance, plus a friendly "overdue" counter when baby takes their time.',
  },
  {
    icon: Bell,
    title: "Push notifications",
    description:
      "Family subscribes once and hears the news the moment it happens. No constant page refreshing.",
  },
  {
    icon: Link2,
    title: "No account needed",
    description:
      "Anyone with the link can check in anytime. Grandma doesn't need to download an app.",
  },
  {
    icon: MessageCircleHeart,
    title: "Encouragements",
    description:
      "Visitors leave messages of love and support — a guestbook of well-wishes you'll keep forever.",
  },
  {
    icon: Palette,
    title: "Themes",
    description:
      "Pick a look that matches your style, from soft pastels to bold colours. Your page, your vibe.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Create your page",
    description: "Sign up and add your baby's name and due date. That's it.",
  },
  {
    step: "02",
    title: "Share the link",
    description: "Send it to family and friends. They can check in anytime and subscribe.",
  },
  {
    step: "03",
    title: "Update as you go",
    description: "When things start happening, update your status. Everyone gets notified.",
  },
];

/** Static mock of a baby page status panel, for the hero */
function HeroMock() {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border/70 bg-card p-5 text-left shadow-sm">
      <div className="flex items-start gap-3.5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-primary/10">
          <Baby className="h-7 w-7 text-primary" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Is Nora out yet?
          </p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight text-primary">Not yet</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Baby is still on the way</p>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">6 days until due date</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Everyone you shared with can see this
        </p>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Journey
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">0%</p>
        </div>
        <Progress value={0} className="h-1" />
      </div>
    </div>
  );
}

function HomePage() {
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
      icon: Baby,
      title: "Waiting",
      description: "Before labour starts",
      search: { name: "Emma" },
    },
    {
      icon: Activity,
      title: "Labour started",
      description: "Things are happening!",
      search: { name: "Oliver", dueDate: hoursAgo(0), laborStarted: hoursAgo(2) },
    },
    {
      icon: Hospital,
      title: "At hospital",
      description: "Almost there!",
      search: {
        name: "Sophia",
        laborStarted: hoursAgo(4),
        wentToHospital: hoursAgo(1),
        hospitalMessage: "We're at the hospital! Will update when baby arrives 💕",
        theme: "porcelain",
      },
    },
    {
      icon: CheckCircle,
      title: "Baby born!",
      description: "Celebrate the arrival",
      search: {
        name: "Liam",
        laborStarted: hoursAgo(6),
        wentToHospital: hoursAgo(3),
        babyBorn: hoursAgo(0.5),
        babyBornMessage: "Welcome to the world, little one! 🎉",
        theme: "violet-bloom",
      },
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center gap-2">
          {sessionData.data ? (
            <Button
              size="sm"
              render={<Link to="/dashboard" preload="viewport" />}
              nativeButton={false}
            >
              Dashboard
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                render={<Link to="/auth/login" preload="viewport" />}
                nativeButton={false}
              >
                Sign in
              </Button>
              <Button
                size="sm"
                render={<Link to="/auth/signup" preload="viewport" />}
                nativeButton={false}
              >
                Get started
              </Button>
            </>
          )}
        </div>
      </AppHeader>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Check className="h-3 w-3 text-primary" />
              Free forever · No ads · Open source
            </p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground text-balance md:text-6xl">
              One link answers "any news yet?"
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Create a page for your baby's arrival. Family checks in anytime, subscribes to
              notifications, and hears the news the moment it happens.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {sessionData.data ? (
                <Button
                  size="lg"
                  render={<Link to="/dashboard" preload="viewport" />}
                  nativeButton={false}
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    render={<Link to="/auth/signup" preload="viewport" />}
                    nativeButton={false}
                  >
                    Create your page
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    render={<Link to="/auth/login" preload="viewport" />}
                    nativeButton={false}
                  >
                    Sign in
                  </Button>
                </>
              )}
            </div>
          </div>
          <HeroMock />
        </section>

        {/* Features */}
        <section className="border-t border-border/60 py-16">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Everything the family needs
          </h2>
          <p className="mt-1.5 text-muted-foreground">
            For you, and for everyone waiting by the phone
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="bg-card p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-4 w-4 text-primary" />
                </span>
                <h3 className="mt-3.5 text-sm font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* See it in action */}
        <section className="border-t border-border/60 py-16">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            See it in action
          </h2>
          <p className="mt-1.5 text-muted-foreground">
            Click any stage to see how your page will look
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {previewStages.map((stage, index) => {
              const isLast = index === previewStages.length - 1;
              return (
                <Link key={stage.title} to="/preview" search={stage.search} className="group">
                  <div className="h-full rounded-xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/30">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isLast ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <stage.icon className="h-4 w-4" />
                    </span>
                    <h3 className="mt-3.5 flex items-center gap-1 text-sm font-semibold text-foreground">
                      {stage.title}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{stage.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border/60 py-16">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            How it works
          </h2>
          <p className="mt-1.5 text-muted-foreground">Up and running in under a minute</p>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step}>
                <p className="font-mono text-sm font-medium text-primary">{item.step}</p>
                <h3 className="mt-2 text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/60 py-16">
          <div className="rounded-xl border border-border/70 bg-muted/30 px-6 py-12 text-center md:px-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Ready to share the journey?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {sessionData.data
                ? "Head back to your dashboard to keep everyone updated."
                : "Join families who've already shared their special moments. Takes less than a minute."}
            </p>
            <div className="mt-7">
              {sessionData.data ? (
                <Button
                  size="lg"
                  render={<Link to="/dashboard" preload="viewport" />}
                  nativeButton={false}
                >
                  Go to Dashboard
                </Button>
              ) : (
                <Button
                  size="lg"
                  render={<Link to="/auth/signup" preload="viewport" />}
                  nativeButton={false}
                >
                  Get Started Free
                </Button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8 text-center">
        <a
          href="https://github.com/KATT/isbabyoutyet"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <GithubIcon className="h-4 w-4" />
          <span>Open source on GitHub</span>
        </a>
      </footer>
    </div>
  );
}
