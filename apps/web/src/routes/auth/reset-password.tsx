import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
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

const searchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
});

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPasswordPage,
  validateSearch: searchSchema,
});

function ResetPasswordPage() {
  const router = useRouter();
  const search = Route.useSearch();
  const form = useZodForm({
    schema: resetPasswordSchema,
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });
  const invalidLink = !search.token || search.error === "INVALID_TOKEN";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 mb-2 mx-auto">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>
              {invalidLink
                ? "This reset link is invalid or has expired."
                : "Use at least eight characters for your new password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invalidLink ? (
              <Button
                render={<Link to="/auth/forgot-password" />}
                nativeButton={false}
                className="w-full"
              >
                Request another link
              </Button>
            ) : (
              <Form
                form={form}
                handleSubmit={async (values) => {
                  if (!search.token) {
                    throw new Error("This reset link is invalid or has expired");
                  }
                  const result = await authClient.resetPassword({
                    newPassword: values.password,
                    token: search.token,
                  });
                  if (result.error) {
                    throw new Error(result.error.message || "Unable to reset your password");
                  }
                  await router.navigate({ to: "/auth/login" });
                }}
              >
                <div className="space-y-5">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
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
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm new password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            className="border-2"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Updating..." : "Update password"}
                  </Button>
                </div>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
