import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@workspace/convex/convex/_generated/api";
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
      <div className="mx-auto max-w-md px-6 py-10">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 text-muted-foreground"
          render={<Link to="/dashboard" preload="viewport" />}
          nativeButton={false}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold tracking-tight">Add a baby</CardTitle>
            <CardDescription>
              A name and a due date — that's all it takes to start the page
            </CardDescription>
          </CardHeader>
          <CardContent>
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

                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
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
