import { Link } from "@tanstack/react-router";
import { Baby } from "lucide-react";

/**
 * Sticky glass header shared by the baby page and the preview: wordmark on
 * the left, page actions (e.g. BabyNav) on the right.
 */
export function PageHeader(props: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Baby className="h-4 w-4 text-primary" />
          </span>
          <span className="font-serif text-sm italic tracking-wide">isbabyoutyet</span>
        </Link>
        {props.children}
      </div>
    </header>
  );
}
