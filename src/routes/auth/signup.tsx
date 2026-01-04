import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Form, useZodForm } from "@/components/Form";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const Route = createFileRoute("/auth/signup")({
  component: SignupPage,
});

function SignupPage() {
  const router = useRouter();

  const form = useZodForm({
    schema: signupSchema,
    defaultValues: import.meta.env.DEV
      ? {
          name: "Test User",
          email: "test@example.com",
          password: "password",
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
        <div className="bg-card border rounded-2xl p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-foreground mb-2 text-center">Sign Up</h1>
          <p className="text-muted-foreground text-center mb-6">
            Create an account to start tracking
          </p>

          <Form
            form={form}
            handleSubmit={async (values) => {
              const result = await signUp.email({
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
            <div className="space-y-4">
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

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Signing up..." : "Sign Up"}
              </Button>
            </div>
          </Form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth/login" className="text-primary hover:text-primary/80 underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
