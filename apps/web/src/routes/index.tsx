import { Button } from "@workspace/ui/components/button";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Baby } from "lucide-react";
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
];

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
];

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
      emoji: "👶",
      title: "Waiting",
      description: "Before labour starts",
      rotate: "group-hover:-rotate-1",
      search: { name: "Emma" },
    },
    {
      emoji: "💫",
      title: "Labour started",
      description: "Things are happening!",
      rotate: "group-hover:rotate-1",
      search: { name: "Oliver", dueDate: hoursAgo(0), laborStarted: hoursAgo(2) },
    },
    {
      emoji: "🏥",
      title: "At hospital",
      description: "Almost there!",
      rotate: "group-hover:-rotate-1",
      search: {
        name: "Sophia",
        laborStarted: hoursAgo(4),
        wentToHospital: hoursAgo(1),
        hospitalMessage: "We're at the hospital! Will update when baby arrives 💕",
        theme: "bubblegum",
      },
    },
    {
      emoji: "🎉",
      title: "Baby born!",
      description: "Celebrate the arrival",
      rotate: "group-hover:rotate-1",
      search: {
        name: "Liam",
        laborStarted: hoursAgo(6),
        wentToHospital: hoursAgo(3),
        babyBorn: hoursAgo(0.5),
        babyBornMessage: "Welcome to the world, little one! 🎉",
        theme: "sunny-days",
      },
    },
  ];

  return (
    <div className="min-h-screen bg-background bg-dots">
      {/* Floating header */}
      <header className="sticky top-0 z-20 px-4 pt-3 pb-1">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <span className="flex items-center gap-2 rounded-full border-2 border-border bg-background/85 py-1.5 pl-2 pr-4 backdrop-blur-md shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
              <Baby className="h-4 w-4 text-primary" />
            </span>
            <span className="text-sm font-extrabold tracking-tight">isbabyoutyet</span>
          </span>
          <div className="flex items-center gap-2">
            {sessionData.data ? (
              <Button
                size="sm"
                className="rounded-full font-bold"
                render={<Link to="/dashboard" preload="viewport" />}
                nativeButton={false}
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full font-bold border-2"
                  render={<Link to="/auth/login" preload="viewport" />}
                  nativeButton={false}
                >
                  Sign in
                </Button>
                <Button
                  size="sm"
                  className="rounded-full font-bold"
                  render={<Link to="/auth/signup" preload="viewport" />}
                  nativeButton={false}
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="py-16 text-center md:py-24">
          <span className="inline-block -rotate-2 rounded-full border-2 border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-extrabold text-primary pop-shadow">
            ✨ Free forever, no ads
          </span>
          <h1 className="mx-auto mt-8 max-w-3xl text-5xl font-black tracking-tight text-foreground text-balance md:text-7xl">
            Is{" "}
            <span className="inline-block -rotate-1 rounded-3xl bg-primary/15 px-4 text-primary">
              baby
            </span>{" "}
            out yet?
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-semibold leading-relaxed text-muted-foreground md:text-xl">
            Stop answering "any news yet?" texts. Share one link, let everyone follow along, and
            tell them all at once when baby arrives. 🍼
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {sessionData.data ? (
              <Button
                size="lg"
                className="h-auto rounded-full px-8 py-4 text-base font-extrabold pop-shadow-strong"
                render={<Link to="/dashboard" preload="viewport" />}
                nativeButton={false}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="h-auto rounded-full px-8 py-4 text-base font-extrabold pop-shadow-strong"
                  render={<Link to="/auth/signup" preload="viewport" />}
                  nativeButton={false}
                >
                  Create your page 🎈
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-auto rounded-full border-2 bg-background/70 px-8 py-4 text-base font-extrabold"
                  render={<Link to="/auth/login" preload="viewport" />}
                  nativeButton={false}
                >
                  Sign in
                </Button>
              </>
            )}
          </div>
        </section>

        {/* Features */}
        <section className="py-12">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
              Everything the family needs
            </h2>
            <p className="mt-2 font-semibold text-muted-foreground">
              For you, and for everyone waiting by the phone
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <div
                key={feature.title}
                className={`rounded-3xl border-2 border-border bg-card p-6 pop-shadow transition-transform hover:-translate-y-1 ${
                  index % 2 === 0 ? "hover:-rotate-1" : "hover:rotate-1"
                }`}
              >
                <span className="text-3xl" aria-hidden="true">
                  {feature.emoji}
                </span>
                <h3 className="mt-3 text-lg font-extrabold text-foreground">{feature.title}</h3>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* See it in action */}
        <section className="py-12">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
              See it in action
            </h2>
            <p className="mt-2 font-semibold text-muted-foreground">
              Click any stage to see how your page will look
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {previewStages.map((stage) => (
              <Link key={stage.title} to="/preview" search={stage.search} className="group">
                <div
                  className={`h-full rounded-3xl border-2 border-border bg-card p-6 text-center pop-shadow transition-transform group-hover:-translate-y-1 ${stage.rotate}`}
                >
                  <span className="text-4xl" aria-hidden="true">
                    {stage.emoji}
                  </span>
                  <h3 className="mt-3 font-extrabold text-foreground">{stage.title}</h3>
                  <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                    {stage.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="py-12">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
              How it works
            </h2>
            <p className="mt-2 font-semibold text-muted-foreground">
              Up and running in under a minute
            </p>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 -rotate-3 items-center justify-center rounded-2xl border-2 border-primary/30 bg-primary/15 text-2xl font-black text-primary pop-shadow">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-extrabold text-foreground">{item.title}</h3>
                <p className="mt-1.5 font-medium leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 text-center">
          <div className="mx-auto max-w-2xl rounded-[2rem] border-2 border-primary/25 bg-primary/10 px-8 py-12 pop-shadow-strong">
            <p className="text-4xl" aria-hidden="true">
              💖
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">
              Ready to share the journey?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg font-semibold text-muted-foreground">
              {sessionData.data
                ? "Head back to your dashboard to keep everyone updated."
                : "Join families who've already shared their special moments. Takes less than a minute."}
            </p>
            <div className="mt-7">
              {sessionData.data ? (
                <Button
                  size="lg"
                  className="rounded-full font-extrabold"
                  render={<Link to="/dashboard" preload="viewport" />}
                  nativeButton={false}
                >
                  Go to Dashboard
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="rounded-full font-extrabold"
                  render={<Link to="/auth/signup" preload="viewport" />}
                  nativeButton={false}
                >
                  Get Started Free 🎉
                </Button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-border/60 bg-background/60 py-8 text-center">
        <a
          href="https://github.com/KATT/isbabyoutyet"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          <GithubIcon className="h-5 w-5" />
          <span>Open source on GitHub</span>
        </a>
      </footer>
    </div>
  );
}
