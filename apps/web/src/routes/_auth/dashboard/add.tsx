import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@workspace/convex/convex/_generated/api";
import type { BirthJourney } from "@workspace/convex/src/types";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Form, useZodForm } from "@/components/Form";
import { htmlDate } from "@/lib/html-date";
import { ArrowLeft } from "@phosphor-icons/react";
import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

function addBabySchema(t: TranslationFunction) {
  return z
    .object({
      name: z.string().trim().min(2, t("Name is required")),
      birthJourney: z.union([z.literal("labour"), z.literal("planned_c_section")]),
      dueDate: htmlDate(t),
    })
    .transform((values): FunctionArgs<typeof api.baby.create> => values);
}

export const Route = createFileRoute("/_auth/dashboard/add")({
  component: AddBabyPage,
});

function AddBabyPage() {
  const { t } = useI18n();
  const router = useRouter();
  const createBaby = useMutation(api.baby.create);

  const form = useZodForm({
    schema: addBabySchema(t),
    defaultValues: {
      name: "",
      birthJourney: "labour" as BirthJourney,
      dueDate: "",
    },
  });
  const birthJourney = form.watch("birthJourney");

  return (
    <div className="min-h-screen bg-background bg-dots">
      <div className="mx-auto max-w-xl px-6 py-10">
        <Button
          variant="outline"
          size="sm"
          className="mb-8 rounded-full border-2 font-bold"
          render={<Link to="/dashboard" />}
          nativeButton={false}
        >
          <ArrowLeft className="w-4 h-4" />
          {t("Back to Dashboard")}
        </Button>

        <div className="mb-8 text-center">
          <p className="text-5xl" aria-hidden="true">
            🎉
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground md:text-5xl">
            {t("Add a")}{" "}
            <span className="inline-block -rotate-1 rounded-2xl bg-primary/15 px-3 text-primary">
              {t("baby")}
            </span>
          </h1>
          <p className="mt-2 font-semibold text-muted-foreground">
            {t("A name and a due date — that's all it takes!")}
          </p>
        </div>

        <Card className="rounded-[2rem] border-2 pop-shadow-strong">
          <CardContent className="pt-6">
            <Form
              form={form}
              handleSubmit={async (values) => {
                const result = await createBaby(values);

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
                      <FormLabel className="font-bold">{t("Baby Name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("Enter baby's name")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="birthJourney"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">{t("Birth plan")}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                        >
                          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-border p-4 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/5">
                            <RadioGroupItem value="labour" />
                            <span>
                              <span className="block font-bold">{t("Labour")}</span>
                              <span className="block text-sm text-muted-foreground">
                                {t("Follow labour, hospital and birth")}
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-border p-4 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/5">
                            <RadioGroupItem value="planned_c_section" />
                            <span>
                              <span className="block font-bold">{t("Planned C-section")}</span>
                              <span className="block text-sm text-muted-foreground">
                                {t("Skip labour and follow hospital and birth")}
                              </span>
                            </span>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormDescription>
                        {t("You can change this later in settings.")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">
                        {birthJourney === "planned_c_section" ? t("C-section date") : t("Due Date")}
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full rounded-full font-extrabold pop-shadow"
                  disabled={form.formState.isSubmitting}
                  size="lg"
                >
                  {form.formState.isSubmitting ? t("Creating...") : t("Add Baby 🍼")}
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
