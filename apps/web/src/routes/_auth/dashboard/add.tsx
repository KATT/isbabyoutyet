import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@workspace/convex/convex/_generated/api";
import { milestoneVisibilityForPreset } from "@workspace/convex/src/types";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Card, CardContent } from "@workspace/ui/components/card";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
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
      dueDate: htmlDate(t),
      milestonePreset: z.union([
        z.literal("labour"),
        z.literal("home_birth"),
        z.literal("planned_c_section"),
      ]),
    })
    .transform((values): FunctionArgs<typeof api.baby.create> => {
      const visibility = milestoneVisibilityForPreset(values.milestonePreset);
      return {
        name: values.name,
        dueDate: values.dueDate,
        showLaborMilestone: visibility.showLabor,
        showHospitalMilestone: visibility.showHospital,
      };
    });
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
      dueDate: "",
      milestonePreset: "labour" as const,
    },
  });

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
            {t("A name, a date, and a private journey — that's all it takes!")}
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
                  render={(renderProps) => (
                    <FormItem>
                      <FormLabel className="font-bold">{t("Baby Name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("Enter baby's name")} {...renderProps.field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={(renderProps) => (
                    <FormItem>
                      <FormLabel className="font-bold">{t("Due Date")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...renderProps.field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="milestonePreset"
                  render={(renderProps) => (
                    <FormItem>
                      <FormLabel className="font-bold">{t("Choose a journey")}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={renderProps.field.value}
                          onValueChange={renderProps.field.onChange}
                          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                        >
                          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-border p-4 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/5">
                            <RadioGroupItem value="labour" />
                            <span>
                              <span className="block font-bold">{t("Labour")}</span>
                              <span className="block text-sm text-muted-foreground">
                                {t("Visitors see: Labour started → At hospital → Baby born")}
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-border p-4 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/5">
                            <RadioGroupItem value="home_birth" />
                            <span>
                              <span className="block font-bold">{t("Home birth")}</span>
                              <span className="block text-sm text-muted-foreground">
                                {t("Visitors see: Labour started → Baby born")}
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-border p-4 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/5">
                            <RadioGroupItem value="planned_c_section" />
                            <span>
                              <span className="block font-bold">{t("Planned C-section")}</span>
                              <span className="block text-sm text-muted-foreground">
                                {t("Visitors see: At hospital → Baby born")}
                              </span>
                            </span>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormDescription>
                        {t(
                          "This choice is not saved or shown publicly. It only sets which statuses visitors can see.",
                        )}
                      </FormDescription>
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
