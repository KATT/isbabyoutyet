import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { createFileRoute } from "@tanstack/react-router";
import { hasDemoLogin } from "@/lib/has-demo-login";
import { useI18n } from "@/lib/i18n";
import { openOverlayLink, useBabyLoginOverlay } from "@/lib/overlay-nav";
import { LoginCard, signInThenGo } from "@/routes/auth/login";

export const Route = createFileRoute("/baby/$publicId/login")({
  component: BabyLoginOverlay,
});

export function BabyLoginOverlay() {
  const { t } = useI18n();
  const context = Route.useRouteContext();
  const params = Route.useParams();
  const login = useBabyLoginOverlay(params.publicId);

  return (
    <Dialog {...login.rootProps}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("Welcome back!")}</DialogTitle>
          <DialogDescription>{t("Sign in to keep everyone in the loop")}</DialogDescription>
        </DialogHeader>
        <LoginCard
          demoLoginEnabled={hasDemoLogin}
          onSignIn={(values) =>
            signInThenGo(values, {
              navigate: () => login.close(),
              queryClient: context.queryClient,
              t,
            })
          }
          signUpLink={{
            ...openOverlayLink({
              params: { publicId: params.publicId },
              to: "/baby/$publicId/signup",
            }),
            replace: true,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
