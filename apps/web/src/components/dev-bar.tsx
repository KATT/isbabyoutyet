import { hasDemoLogin } from "@/lib/has-demo-login";
import {
  DEMO_BABIES,
  DEMO_USER,
  HOMEPAGE_DEMO_BABIES,
} from "@workspace/convex/src/seedCredentials";
import { SUPPORTED_LOCALES } from "@workspace/convex/src/i18n";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { CaretDown, CaretUp, Code, House, SignIn } from "@phosphor-icons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import * as React from "react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "isbabyoutyet:dev-bar-expanded";

function readExpandedPreference() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeExpandedPreference(expanded: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
  } catch {
    // Ignore private-mode / quota failures — preference is best-effort.
  }
}

function activeBabyPublicId(pathname: string) {
  const match = pathname.match(/^\/baby\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * Floating collapsible shortcuts to seeded demo babies. Only mounts in local
 * DEV and Vercel preview (same gate as demo login autofill).
 */
export function DevBar() {
  if (!hasDemoLogin) return null;
  return <DevBarPanel />;
}

function DevBarPanel() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentPublicId = activeBabyPublicId(pathname);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(readExpandedPreference());
  }, []);

  const setExpandedAndPersist = (next: boolean) => {
    setExpanded(next);
    writeExpandedPreference(next);
  };

  if (!expanded) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
        <button
          type="button"
          onClick={() => setExpandedAndPersist(true)}
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-full border-2 border-border",
            "bg-background/90 px-3 py-1.5 text-xs font-extrabold tracking-tight shadow-sm",
            "backdrop-blur-md transition hover:-translate-y-0.5",
          )}
          aria-expanded={false}
          aria-controls="dev-bar-panel"
          aria-label="Expand developer shortcuts"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Code className="size-3.5" />
          </span>
          Dev
          <CaretDown className="size-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <aside
        id="dev-bar-panel"
        className={cn(
          "pointer-events-auto w-[min(100%,28rem)] rounded-2xl border-2 border-border",
          "bg-background/95 p-3 shadow-sm backdrop-blur-md",
          "animate-in fade-in-0 slide-in-from-top-2 duration-200",
        )}
        aria-label="Developer shortcuts"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Code className="size-3.5" />
            </span>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-foreground">Dev</p>
              <p className="text-[0.7rem] font-medium text-muted-foreground">
                Seeded babies · {DEMO_USER.email}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="Collapse developer shortcuts"
            aria-expanded={true}
            aria-controls="dev-bar-panel"
            onClick={() => setExpandedAndPersist(false)}
          >
            <CaretUp />
          </Button>
        </div>

        <div className="space-y-3">
          <ShortcutSection title="Status stages">
            {DEMO_BABIES.map((baby) => (
              <ShortcutLink
                key={baby.publicId}
                to="/baby/$publicId"
                params={{ publicId: baby.publicId }}
                label={baby.label}
                hint={baby.name}
                active={currentPublicId === baby.publicId}
                icon={undefined}
              />
            ))}
          </ShortcutSection>

          <ShortcutSection title="Homepage demos">
            {SUPPORTED_LOCALES.map((locale) => {
              const baby = HOMEPAGE_DEMO_BABIES[locale];
              return (
                <ShortcutLink
                  key={baby.publicId}
                  to="/baby/$publicId"
                  params={{ publicId: baby.publicId }}
                  label={baby.name}
                  hint={locale}
                  active={currentPublicId === baby.publicId}
                  icon={undefined}
                />
              );
            })}
          </ShortcutSection>

          <ShortcutSection title="Pages">
            <ShortcutLink
              to="/dashboard"
              params={undefined}
              label="Dashboard"
              hint={null}
              active={pathname.startsWith("/dashboard")}
              icon={<House className="size-3.5" />}
            />
            <ShortcutLink
              to="/auth/login"
              params={undefined}
              label="Login"
              hint={null}
              active={pathname.startsWith("/auth/login")}
              icon={<SignIn className="size-3.5" />}
            />
            <ShortcutLink
              to="/preview"
              params={undefined}
              label="Preview"
              hint={null}
              active={pathname.startsWith("/preview")}
              icon={<Code className="size-3.5" />}
            />
          </ShortcutSection>
        </div>
      </aside>
    </div>
  );
}

function ShortcutSection(props: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 px-1 text-[0.65rem] font-bold tracking-wide text-muted-foreground uppercase">
        {props.title}
      </h2>
      <ul className="flex flex-col gap-0.5">{props.children}</ul>
    </section>
  );
}

type ShortcutLinkProps = {
  to: "/baby/$publicId" | "/dashboard" | "/auth/login" | "/preview";
  params: { publicId: string } | undefined;
  label: string;
  hint: string | null;
  active: boolean;
  icon: React.ReactNode | undefined;
};

function ShortcutLink(props: ShortcutLinkProps) {
  const content = (
    <>
      {props.icon}
      <span className="min-w-0 flex-1 truncate">{props.label}</span>
      {props.hint ? (
        <span className="shrink-0 text-[0.65rem] font-medium text-muted-foreground">
          {props.hint}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold",
    "transition hover:bg-muted/80",
    props.active && "bg-primary/10 text-primary ring-1 ring-primary/20",
  );

  if (props.to === "/baby/$publicId" && props.params) {
    return (
      <li>
        <Link
          to="/baby/$publicId"
          params={props.params}
          preload="viewport"
          className={className}
          aria-current={props.active ? "page" : undefined}
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <Link
        to={props.to}
        preload="viewport"
        className={className}
        aria-current={props.active ? "page" : undefined}
      >
        {content}
      </Link>
    </li>
  );
}
