import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Form, useZodForm } from "@/components/Form";
import { ArrowLeft } from "lucide-react";

const addBabySchema = z.object({
  name: z.string().min(2, "Name is required"),
  dueDate: z.string().min(1, "Due date is required"),
});

export const Route = createFileRoute("/_auth/dashboard/add")({
  component: AddBabyPage,
});

function AddBabyPage() {
  const router = useRouter();
  const createBaby = useMutation(api.baby.create);

  const form = useZodForm({
    schema: addBabySchema,
    defaultValues: {
      name: "",
      dueDate: "",
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-6 py-12">
        <Button
          variant="ghost"
          size="sm"
          className="mb-8 -ml-2 text-muted-foreground"
          render={<Link to="/dashboard" preload="viewport" />}
          nativeButton={false}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8 text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            A new chapter
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold italic tracking-tight text-foreground md:text-5xl">
            Add a baby
          </h1>
          <p className="mt-2 text-muted-foreground">
            A name and a due date — that's all it takes to start the page
          </p>
        </div>

        <Card className="rounded-3xl">
          <CardContent className="pt-6">
            <Form
              form={form}
              handleSubmit={async (values) => {
                const result = await createBaby({
                  name: values.name,
                  dueDate: values.dueDate,
                });

                await router.navigate({
                  to: "/baby/$publicId",
                  params: { publicId: result.publicId },
                  search: { settings: true },
                });
              }}
            >
              <div className="space-y-5">
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

                <Button
                  type="submit"
                  className="w-full shadow-md shadow-primary/20"
                  disabled={form.formState.isSubmitting}
                  size="lg"
                >
                  {form.formState.isSubmitting ? "Creating..." : "Add Baby"}
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
