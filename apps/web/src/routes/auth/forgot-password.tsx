import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import * as z from "zod";
import { Form, useZodForm } from "@/components/Form";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";
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
import { Input } from "@workspace/ui/components/input";

const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const form = useZodForm({
    schema: forgotPasswordSchema,
    defaultValues: {
      email: "",
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 mb-2 mx-auto">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              {submitted
                ? "Check your inbox for the next step."
                : "Enter your email and we'll send you a secure reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>If an account exists for that address, a password reset email is on its way.</p>
                <Button render={<Link to="/auth/login" />} nativeButton={false} className="w-full">
                  Back to sign in
                </Button>
              </div>
            ) : (
              <Form
                form={form}
                handleSubmit={async (values) => {
                  const result = await authClient.requestPasswordReset({
                    email: values.email,
                    redirectTo: `${import.meta.env.VITE_SITE_URL}/auth/reset-password`,
                  });
                  if (result.error) {
                    throw new Error(result.error.message || "Unable to request a password reset");
                  }
                  setSubmitted(true);
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
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            className="border-2"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Sending..." : "Send reset link"}
                  </Button>
                  <div className="text-center text-sm">
                    <Link
                      to="/auth/login"
                      className="text-primary hover:text-primary/80 underline underline-offset-4"
                    >
                      Back to sign in
                    </Link>
                  </div>
                </div>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
