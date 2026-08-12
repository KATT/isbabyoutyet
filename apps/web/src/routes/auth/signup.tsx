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

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const Route = createFileRoute("/auth/signup")({
  component: SignupPage,
});

// Build-time flag: preview deploys set VITE_HAS_DEMO_LOGIN via deploy-convex.
const hasDemoLogin = import.meta.env.DEV || import.meta.env.VITE_HAS_DEMO_LOGIN === "true";

function SignupPage() {
  const router = useRouter();

  const form = useZodForm({
    schema: signupSchema,
    defaultValues: hasDemoLogin
      ? {
          name: DEMO_USER.name,
          email: DEMO_USER.email,
          password: DEMO_USER.password,
        }
      : {
          name: "",
          email: "",
          password: "",
        },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 flex items-center justify-center gap-2 text-foreground transition-opacity hover:opacity-80"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Baby className="h-5 w-5 text-primary" />
          </span>
          <span className="font-serif text-lg italic tracking-wide">isbabyoutyet</span>
        </Link>
        <Card className="rounded-3xl">
          <CardHeader className="text-center">
            <CardTitle className="font-serif text-3xl font-semibold tracking-tight">
              Start the story
            </CardTitle>
            <CardDescription>Create an account to share your baby's arrival</CardDescription>
          </CardHeader>
          <CardContent>
            <Form
              form={form}
              handleSubmit={async (values) => {
                const result = await authClient.signUp.email({
                  email: values.email,
                  password: values.password,
                  name: values.name,
                });

                if (result.error) {
                  throw new Error(result.error.message || "Failed to sign up");
                }

                await router.navigate({ to: "/dashboard" });
              }}
            >
              <div className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                <Button
                  type="submit"
                  className="w-full shadow-md shadow-primary/20"
                  disabled={form.formState.isSubmitting}
                  size="lg"
                >
                  {form.formState.isSubmitting ? "Signing up..." : "Sign Up"}
                </Button>
              </div>
            </Form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                to="/auth/login"
                preload="viewport"
                className="text-primary hover:text-primary/80 font-medium underline underline-offset-4"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
