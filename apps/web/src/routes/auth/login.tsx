import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Form, useZodForm } from "@/components/Form";
import { LogIn } from "lucide-react";
import { DEMO_USER } from "@workspace/convex/src/seedCredentials";
import { useI18n } from "@/lib/i18n";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

// Build-time flag: preview deploys set VITE_HAS_DEMO_LOGIN via deploy-convex.
const hasDemoLogin = import.meta.env.DEV || import.meta.env.VITE_HAS_DEMO_LOGIN === "true";

function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();

  const form = useZodForm({
    schema: loginSchema,
    defaultValues: hasDemoLogin
      ? {
          email: DEMO_USER.email,
          password: DEMO_USER.password,
        }
      : {
          email: "",
          password: "",
        },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Gradient Background Elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/20 mb-2 mx-auto">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>{t("Sign In")}</CardTitle>
            <CardDescription>{t("Sign in to track your babies")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form
              form={form}
              handleSubmit={async (values) => {
                const result = await authClient.signIn.email({
                  email: values.email,
                  password: values.password,
                  rememberMe: true,
                });

                if (result.error) {
                  throw new Error(result.error.message || "Failed to sign in");
                }

                await router.navigate({ to: "/dashboard" });
              }}
            >
              <div className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Email")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          className="border-2"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Password")}</FormLabel>
                      <FormControl>
                        <Input type="password" className="border-2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full shadow-lg shadow-primary/20"
                  disabled={form.formState.isSubmitting}
                  size="lg"
                >
                  {form.formState.isSubmitting ? t("Signing in...") : t("Sign In")}
                </Button>
              </div>
            </Form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {t("Don't have an account?")}{" "}
              <Link
                to="/auth/signup"
                preload="viewport"
                className="text-primary hover:text-primary/80 font-medium underline underline-offset-4"
              >
                {t("Sign up")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
