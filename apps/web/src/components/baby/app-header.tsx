import { Link } from "@tanstack/react-router";
import { Baby } from "lucide-react";

/**
 * App-shell top bar shared across pages: logo mark on the left, page
 * actions (e.g. BabyNav) on the right.
 */
export function AppHeader(props: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Baby className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Is Baby Out Yet?
          </span>
        </Link>
        {props.children}
      </div>
    </header>
  );
}
