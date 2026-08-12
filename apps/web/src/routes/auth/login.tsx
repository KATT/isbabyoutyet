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
import { Baby } from "lucide-react";
import { DEMO_USER } from "@workspace/convex/src/seedCredentials";

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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-6 flex items-center justify-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Baby className="h-4.5 w-4.5" />
          </span>
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold tracking-tight">Welcome back</CardTitle>
            <CardDescription>Sign in to your Is Baby Out Yet account</CardDescription>
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              </div>
            </Form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/auth/signup"
                preload="viewport"
                className="text-primary hover:text-primary/80 font-medium underline underline-offset-4"
              >
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
