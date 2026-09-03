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
import { useBabyLoginOverlayNav } from "@/lib/overlay-nav";
import { LoginCard, loginAuthAdapter, signInAndHandoff } from "@/routes/auth/login";

export const Route = createFileRoute("/baby/$publicId/login")({
  component: BabyLoginOverlay,
});

export function BabyLoginOverlay() {
  const { t } = useI18n();
  const params = Route.useParams();
  const login = useBabyLoginOverlayNav(params.publicId);

  return (
    <Dialog
      onOpenChange={login.onOpenChange}
      onOpenChangeComplete={login.onOpenChangeComplete}
      open={login.open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("Welcome back!")}</DialogTitle>
          <DialogDescription>{t("Sign in to keep everyone in the loop")}</DialogDescription>
        </DialogHeader>
        <LoginCard
          demoLoginEnabled={hasDemoLogin}
          homeLink={{ params: { publicId: params.publicId }, to: "/baby/$publicId" }}
          onSignIn={(values) =>
            signInAndHandoff(values, {
              failedMessage: t("Failed to sign in"),
              headers: () => loginAuthAdapter.headers(),
              navigate: async () => {
                login.dismiss();
              },
              signIn: async (body, fetchOptions) => {
                const result = await loginAuthAdapter.signInEmail(body, fetchOptions);
                return { errorMessage: result.error ? (result.error.message ?? "") : null };
              },
              waitForAuth: () => loginAuthAdapter.waitForAuth(),
            })
          }
          variant="dialog"
        />
      </DialogContent>
    </Dialog>
  );
}
