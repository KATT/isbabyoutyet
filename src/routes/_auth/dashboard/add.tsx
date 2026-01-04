import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const addBabySchema = z.object({
  name: z.string().min(2, "Name is required"),
  dueDate: z.string().min(1, "Due date is required"),
});

type AddBabyFormValues = z.infer<typeof addBabySchema>;

export const Route = createFileRoute("/_auth/dashboard/add")({
  component: AddBabyPage,
});

function AddBabyPage() {
  const router = useRouter();
  const createBaby = useMutation(api.babies.create);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AddBabyFormValues>({
    resolver: zodResolver(addBabySchema as any),
    defaultValues: {
      name: "",
      dueDate: "",
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <Link to="/dashboard">
            <Button variant="ghost" className="mb-4">
              ← Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-foreground">Add a Baby</h1>
          <p className="text-muted-foreground mt-2">Track the progress of labor and birth</p>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-2xl">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async (values) => {
                setError(null);

                try {
                  const result = await createBaby({
                    name: values.name,
                    dueDate: values.dueDate,
                  });

                  await router.navigate({
                    to: "/baby/$publicId",
                    params: { publicId: result.publicId },
                  });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to create baby");
                }
              })}
              className="space-y-4"
            >
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Baby Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter baby's name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating..." : "Add Baby"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
