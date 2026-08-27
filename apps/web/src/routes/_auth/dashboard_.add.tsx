import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import type { NavigateOptions } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@workspace/convex/convex/_generated/api";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { DueDateDisplayFields } from "@/components/baby/dueDateDisplayFields";
import { AddBabyOptionalSettings } from "@/components/baby/add-baby-optional-settings";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Form, SubmitButton, useZodForm } from "@/components/Form";
import { htmlDate } from "@/lib/html-date";
import { ArrowLeft } from "@phosphor-icons/react";
import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

function addBabySchema(t: TranslationFunction) {
  return z
    .object({
      name: z.string().trim().min(2, t("Name is required")),
      dueDate: htmlDate(t),
      showExactDueDate: z.boolean(),
      publicDueDateText: z.string().trim().max(80, t("Keep this under 80 characters")),
      birthJourney: z.union([
        z.literal("labor"),
        z.literal("home_birth"),
        z.literal("planned_c_section"),
        z.literal("custom"),
      ]),
      theme: z.union([z.string(), z.null()]),
    })
    .superRefine((values, ctx) => {
      if (values.showExactDueDate && !values.dueDate) {
        ctx.addIssue({
          code: "custom",
          path: ["dueDate"],
          message: t("Pick a date"),
        });
      }
    })
    .transform((values): FunctionArgs<typeof api.baby.create> => ({
      name: values.name,
      dueDate: values.dueDate,
      dueDateDisplayMode: values.showExactDueDate ? "exact" : "message",
      publicDueDateText: values.publicDueDateText || null,
      birthJourney: values.birthJourney,
      theme: values.theme,
    }));
}

export const Route = createFileRoute("/_auth/dashboard_/add")({
  component: AddBabyPage,
});

type CreateBaby = (args: FunctionArgs<typeof api.baby.create>) => Promise<{ publicId: string }>;

export function AddBabyPage() {
  const router = useRouter();
  const createBaby = useMutation(api.baby.create);

  return <AddBabyPageView createBaby={createBaby} navigate={(opts) => router.navigate(opts)} />;
}

/**
 * Presentational add-baby form. Mutation + navigate arrive as props so tests
 * can drive submit without mocking Convex or the router module.
 *
 * @internal exported for tests
 */
export function AddBabyPageView(props: {
  createBaby: CreateBaby;
  navigate: (opts: NavigateOptions) => Promise<void>;
}) {
  const { t } = useI18n();

  const form = useZodForm({
    schema: addBabySchema(t),
    defaultValues: {
      name: "",
      dueDate: "",
      showExactDueDate: true,
      publicDueDateText: "",
      birthJourney: "labor" as const,
      theme: null,
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
            {t("A name and a due date — that's all it takes!")}
          </p>
        </div>

        <Card className="rounded-[2rem] border-2 pop-shadow-strong">
          <CardContent className="pt-6">
            <Form
              form={form}
              handleSubmit={async (values) => {
                const result = await props.createBaby(values);

                await props.navigate({
                  to: "/baby/$publicId",
                  params: { publicId: result.publicId },
                });
              }}
            >
              <div className="flex flex-col gap-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={(renderProps) => (
                    <FormItem>
                      <FormLabel className="font-bold">{t("Baby Name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("Enter baby's name")} {...renderProps.field} />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "Optional — leave blank for now. You can change the time later in settings.",
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DueDateDisplayFields
                  control={form.control}
                  dateFieldName="dueDate"
                  className={undefined}
                  sectionLabelClassName="font-bold"
                  stopPopoverPropagation={false}
                />

                <AddBabyOptionalSettings
                  control={form.control}
                  birthJourneyFieldName="birthJourney"
                  themeFieldName="theme"
                />

                <SubmitButton
                  form="context"
                  IconComponent="🍼"
                  iconPosition="end"
                  className="w-full rounded-full font-extrabold pop-shadow"
                  size="lg"
                >
                  {t("Add Baby")}
                </SubmitButton>
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
