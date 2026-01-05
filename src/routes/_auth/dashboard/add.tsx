import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Form, useZodForm } from "@/components/Form";
import { Baby, ArrowLeft } from "lucide-react";

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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Gradient Background Elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link to="/dashboard" preload="viewport">
            <Button variant="outline" className="shadow-lg shadow-primary/20 mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-5xl font-black text-foreground mb-3 tracking-tight">
            <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Add a Baby
            </span>
          </h1>
          <p className="text-muted-foreground text-lg">Track the progress of labor and birth</p>
        </div>

        <Card>
          <CardHeader>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/20 mb-2">
              <Baby className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Baby Information</CardTitle>
            <CardDescription>Enter your baby's name and due date to get started</CardDescription>
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
                        <Input placeholder="Enter baby's name" className="border-2" {...field} />
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
                        <Input type="date" className="border-2" {...field} />
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
