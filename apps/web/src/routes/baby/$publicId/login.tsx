import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { api } from "@workspace/convex/convex/_generated/api";
import { hasDemoLogin } from "@/lib/has-demo-login";
import { useI18n } from "@/lib/i18n";
import { useBabyLoginOverlayNav } from "@/lib/overlay-nav";
import { LoginCard, loginAuthAdapter, signInAndHandoff } from "@/routes/auth/login";

export const Route = createFileRoute("/baby/$publicId/login")({
  beforeLoad: async (opts) => {
    const baby = await opts.context.convexPreloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc) {
      throw notFound();
    }
    if (babyDoc.publicId !== opts.params.publicId) {
      throw redirect({
        to: "/baby/$publicId/login",
        params: { publicId: babyDoc.publicId },
        replace: true,
      });
    }
  },
  component: BabyLoginOverlay,
});

export function BabyLoginOverlay() {
  const { t } = useI18n();
  const params = Route.useParams();
  const login = useBabyLoginOverlayNav(params.publicId);

  return (
    <Dialog
      open={login.open}
      onOpenChange={login.onOpenChange}
      onOpenChangeComplete={login.onOpenChangeComplete}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("Welcome back!")}</DialogTitle>
          <DialogDescription>{t("Sign in to keep everyone in the loop")}</DialogDescription>
        </DialogHeader>
        <LoginCard
          demoLoginEnabled={hasDemoLogin}
          variant="dialog"
          homeLink={{ to: "/baby/$publicId", params: { publicId: params.publicId } }}
          onSignIn={(values) =>
            signInAndHandoff(values, {
              signIn: async (body, fetchOptions) => {
                const result = await loginAuthAdapter.signInEmail(body, fetchOptions);
                return { errorMessage: result.error ? (result.error.message ?? "") : null };
              },
              headers: () => loginAuthAdapter.headers(),
              waitForAuth: () => loginAuthAdapter.waitForAuth(),
              navigate: async () => {
                login.dismiss();
              },
              failedMessage: t("Failed to sign in"),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
