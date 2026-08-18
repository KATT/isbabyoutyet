import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { DEMO_ACCOUNTS } from "@workspace/convex/src/seedCredentials";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";
import { Label } from "@workspace/ui/components/label";
import { authClient } from "@/lib/auth-client";
import { hasDemoLogin } from "@/lib/has-demo-login";

/**
 * Preview/local-only picker that fills a seeded test account and signs in.
 */
export function DemoAccountPicker(props: {
  onPrefill: (account: (typeof DEMO_ACCOUNTS)[number]) => void;
}) {
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (!hasDemoLogin) return null;

  return (
    <div className="mb-5 flex flex-col gap-1.5 rounded-2xl border-2 border-dashed border-border bg-muted/40 p-3">
      <Label htmlFor="demo-account-picker" className="text-xs font-extrabold text-muted-foreground">
        Test account
      </Label>
      <NativeSelect
        id="demo-account-picker"
        className="w-full"
        defaultValue=""
        disabled={isSigningIn}
        onChange={(event) => {
          const account = DEMO_ACCOUNTS.find((item) => item.email === event.currentTarget.value);
          if (!account) return;

          props.onPrefill(account);
          setIsSigningIn(true);
          void authClient.signIn
            .email({
              email: account.email,
              password: account.password,
              rememberMe: true,
            })
            .then(async (result) => {
              if (result.error) {
                throw new Error(result.error.message || "Failed to sign in");
              }
              await router.navigate({ to: "/dashboard" });
            })
            .catch((error: unknown) => {
              toast.error(error instanceof Error ? error.message : "Failed to sign in");
              setIsSigningIn(false);
            });
        }}
      >
        <NativeSelectOption value="" disabled>
          Choose a test account…
        </NativeSelectOption>
        {DEMO_ACCOUNTS.map((account) => (
          <NativeSelectOption key={account.email} value={account.email}>
            {account.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
