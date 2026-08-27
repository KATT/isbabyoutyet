import {
  DEMO_BABIES,
  DEMO_USER,
  HOMEPAGE_DEMO_BABIES,
} from "@workspace/convex/src/seedCredentials";
import { SUPPORTED_LOCALES } from "@workspace/convex/src/i18n";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { colors } from "@workspace/ui/lib/tokens.stylex";
import { Check, Code, House, SignIn } from "@phosphor-icons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  bar: {
    pointerEvents: "none",
    position: "fixed",
    insetInline: 0,
    top: "0.75rem",
    zIndex: 50,
    display: "flex",
    justifyContent: "center",
    paddingInline: "1rem",
  },
  triggerWrap: {
    pointerEvents: "auto",
  },
  itemLabel: {
    minWidth: 0,
    flexGrow: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemMeta: {
    color: colors.mutedForeground,
  },
});

/** @internal Exported for tests. */
export function activeBabyPublicId(pathname: string) {
  const match = pathname.match(/^\/baby\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * The shortcut for the page you are already on is marked `aria-current`, which
 * is also how tests tell an active entry from an inactive one (every entry
 * renders an icon, so the check mark alone is not observable).
 */
function currentPage(isActive: boolean) {
  return isActive ? ("page" as const) : undefined;
}

/**
 * Floating shortcuts to seeded demo babies. Call sites must gate on
 * `hasDemoLogin` (`import.meta.env.DEV` / `VITE_HAS_DEMO_LOGIN`) so production
 * builds never mount this component — do not render `{false && <DevBar />}`
 * wrappers that still evaluate an `enabled` prop at runtime.
 */
export function DevBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentPublicId = activeBabyPublicId(pathname);
  const onDashboard = pathname.startsWith("/dashboard");
  const onLogin = pathname.startsWith("/auth/login");
  const onPreview = pathname.startsWith("/preview");

  return (
    <div {...stylex.props(styles.bar)}>
      <DropdownMenu key={pathname}>
        <span {...stylex.props(styles.triggerWrap)}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                shape="pill"
                aria-label="Developer shortcuts"
              />
            }
          >
            <Code data-icon="inline-start" />
            Dev
          </DropdownMenuTrigger>
        </span>

        <DropdownMenuContent align="center" side="bottom" sideOffset={8} size="md">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Seeded babies · {DEMO_USER.email}</DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel>Status stages</DropdownMenuLabel>
            {DEMO_BABIES.map((baby) => (
              <DropdownMenuItem
                key={baby.publicId}
                render={
                  <Link
                    to="/baby/$publicId"
                    params={{ publicId: baby.publicId }}
                    aria-current={currentPage(currentPublicId === baby.publicId)}
                  />
                }
              >
                {currentPublicId === baby.publicId ? <Check data-icon="inline-start" /> : null}
                <span {...stylex.props(styles.itemLabel)}>{baby.label}</span>
                <span {...stylex.props(styles.itemMeta)}>{baby.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel>Homepage demos</DropdownMenuLabel>
            {SUPPORTED_LOCALES.map((locale) => {
              const baby = HOMEPAGE_DEMO_BABIES[locale];
              return (
                <DropdownMenuItem
                  key={baby.publicId}
                  render={
                    <Link
                      to="/baby/$publicId"
                      params={{ publicId: baby.publicId }}
                      aria-current={currentPage(currentPublicId === baby.publicId)}
                    />
                  }
                >
                  {currentPublicId === baby.publicId ? <Check data-icon="inline-start" /> : null}
                  <span {...stylex.props(styles.itemLabel)}>{baby.name}</span>
                  <span {...stylex.props(styles.itemMeta)}>{locale}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel>Pages</DropdownMenuLabel>
            <DropdownMenuItem
              render={<Link to="/dashboard" aria-current={currentPage(onDashboard)} />}
            >
              {onDashboard ? (
                <Check data-icon="inline-start" />
              ) : (
                <House data-icon="inline-start" />
              )}
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link to="/auth/login" aria-current={currentPage(onLogin)} />}
            >
              {onLogin ? <Check data-icon="inline-start" /> : <SignIn data-icon="inline-start" />}
              Login
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/preview" aria-current={currentPage(onPreview)} />}>
              {onPreview ? <Check data-icon="inline-start" /> : <Code data-icon="inline-start" />}
              Preview
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
