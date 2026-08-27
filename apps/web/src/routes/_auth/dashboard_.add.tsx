import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import type { NavigateOptions } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
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
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  page: {
    backgroundColor: colors.background,
    backgroundImage: `radial-gradient(color-mix(in oklab, ${colors.border} 80%, transparent) 1.5px, transparent 1.5px)`,
    backgroundSize: "22px 22px",
    minHeight: "100vh",
  },
  inner: {
    marginInline: "auto",
    maxWidth: "36rem",
    paddingBlock: spacing.s10,
    paddingInline: spacing.s6,
  },
  backRow: {
    marginBottom: spacing.s8,
  },
  heroEmoji: {
    fontSize: "3rem",
    lineHeight: 1,
    margin: 0,
  },
  title: {
    color: colors.foreground,
    fontSize: {
      default: "2.25rem",
      "@media (min-width: 768px)": "3rem",
    },
    fontWeight: 900,
    letterSpacing: "-0.025em",
    lineHeight: 1.1,
    margin: 0,
    textAlign: "center",
  },
  titleAccent: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    borderRadius: radius.xl,
    color: colors.primary,
    display: "inline-block",
    paddingInline: spacing.s3,
    transform: "rotate(-1deg)",
  },
});

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
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.inner)}>
        <div {...stylex.props(styles.backRow)}>
          <Button
            variant="outline"
            size="sm"
            shape="pill"
            render={<Link to="/dashboard" />}
            nativeButton={false}
          >
            <ArrowLeft data-icon="inline-start" />
            {t("Back to Dashboard")}
          </Button>
        </div>

        <Stack gap="s8" fullWidth>
          <Stack gap="s2" align="center" fullWidth>
            <p {...stylex.props(styles.heroEmoji)} aria-hidden="true">
              🎉
            </p>
            <h1 {...stylex.props(styles.title)}>
              {t("Add a")} <span {...stylex.props(styles.titleAccent)}>{t("baby")}</span>
            </h1>
            <Text tone="muted" weight="semibold" align="center">
              {t("A name and a due date — that's all it takes!")}
            </Text>
          </Stack>

          <Card>
            <CardContent>
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
                <Stack gap="s5" fullWidth>
                  <FormField
                    control={form.control}
                    name="name"
                    render={(renderProps) => (
                      <FormItem>
                        <FormLabel>{t("Baby Name")}</FormLabel>
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
                    sectionLabelClassName={undefined}
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
                    size="lg"
                    shape="pill"
                  >
                    {t("Add Baby")}
                  </SubmitButton>
                </Stack>
              </Form>
            </CardContent>
          </Card>
        </Stack>
      </div>
    </div>
  );
}
