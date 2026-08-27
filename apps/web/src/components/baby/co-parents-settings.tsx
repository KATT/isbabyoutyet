import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { Button } from "@workspace/ui/components/button";
import { FormControl, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { toast } from "sonner";
import { UserMinus, UserPlus, X } from "@phosphor-icons/react";
import * as stylex from "@stylexjs/stylex";
import * as z from "zod";
import { FORBIDDEN } from "@workspace/convex/src/types";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { Form, SubmitButton, useZodForm } from "@/components/Form";
import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

type CoParentsListing = Exclude<
  FunctionReturnType<typeof api.coParents.listForBaby>,
  typeof FORBIDDEN
>;

type InviteArgs = FunctionArgs<typeof api.coParents.invite>;

const styles = stylex.create({
  grow: {
    flexGrow: 1,
    minWidth: 0,
  },
});

function inviteCoParentSchema(t: TranslationFunction, babyId: Id<"baby">) {
  return z
    .object({
      email: z.string().trim().email(t("Invalid email address")),
    })
    .transform((values): InviteArgs => ({
      babyId,
      email: values.email,
    }));
}

function InviteCoParentForm(props: {
  babyId: Id<"baby">;
  onInvite: (args: InviteArgs) => Promise<{ status: "added" | "invited" }>;
}) {
  const { t } = useI18n();
  const form = useZodForm({
    schema: inviteCoParentSchema(t, props.babyId),
    defaultValues: { email: "" },
  });

  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        const result = await props.onInvite(values);
        form.reset({ email: "" });
        toast.success(
          result.status === "added"
            ? t("Co-parent added — they can manage this page now")
            : t("Invite sent — they'll get access after signing up with that email"),
        );
      }}
    >
      <Inline gap="s2" wrap={false} fullWidth>
        <div {...stylex.props(styles.grow)}>
          <FormField
            control={form.control}
            name="email"
            render={(fieldProps) => (
              <FormItem>
                <FormControl>
                  <Input type="email" placeholder="partner@example.com" {...fieldProps.field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <SubmitButton form="context" IconComponent={UserPlus} iconPosition="start" size="sm">
          {t("Add")}
        </SubmitButton>
      </Inline>
    </Form>
  );
}

type CoParentsSettingsProps = {
  babyId: Id<"baby">;
  /** Only the owner can invite/remove; co-parents see a read-only list. */
  isOwner: boolean;
  listing: PreloadedConvexQuery<typeof api.coParents.listForBaby>;
};

/**
 * Settings section for inviting co-parents by email and managing membership.
 * Prefetched via the baby route loader when settings are open.
 */
export function CoParentsSettings(props: CoParentsSettingsProps) {
  const { t } = useI18n();
  const listingQuery = usePreloadedConvexQuery(api.coParents.listForBaby, props.listing);
  // FORBIDDEN only happens for non-managers, who never render this component —
  // treat it like an empty listing so the types stay honest.
  const listing: CoParentsListing =
    listingQuery.data === FORBIDDEN ? { coParents: [], invites: [] } : listingQuery.data;
  const invite = useMutation(api.coParents.invite);
  const removeCoParent = useMutation(api.coParents.removeCoParent);
  const cancelInvite = useMutation(api.coParents.cancelInvite);

  return (
    <Stack gap="s3" fullWidth>
      <Stack gap="s2" fullWidth role="list">
        {listing.coParents.map((row) => (
          <div key={row._id} role="listitem">
            <Inline gap="s2" justify="between" wrap={false} fullWidth>
              <div {...stylex.props(styles.grow)}>
                <Text as="div" size="sm" weight="medium" truncate>
                  {row.name || row.email}
                </Text>
                {row.name ? (
                  <Text as="div" size="sm" tone="muted" truncate>
                    {row.email}
                  </Text>
                ) : null}
              </div>
              {props.isOwner ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("Remove {{email}}", { email: row.email })}
                  onClick={() => {
                    void removeCoParent({ coParentId: row._id })
                      .then(() => toast.success(t("Co-parent removed")))
                      .catch((error) => {
                        toast.error(error instanceof Error ? error.message : t("Could not remove"));
                      });
                  }}
                >
                  <UserMinus size={16} />
                </Button>
              ) : null}
            </Inline>
          </div>
        ))}
        {listing.invites.map((row) => (
          <div key={row._id} role="listitem">
            <Inline gap="s2" justify="between" wrap={false} fullWidth>
              <div {...stylex.props(styles.grow)}>
                <Text as="div" size="sm" weight="medium" truncate>
                  {row.email}
                </Text>
                <Text as="div" size="sm" tone="muted">
                  {t("Invite pending")}
                </Text>
              </div>
              {props.isOwner ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("Cancel invite to {{email}}", { email: row.email })}
                  onClick={() => {
                    void cancelInvite({ inviteId: row._id })
                      .then(() => toast.success(t("Invite cancelled")))
                      .catch((error) => {
                        toast.error(error instanceof Error ? error.message : t("Could not cancel"));
                      });
                  }}
                >
                  <X size={16} />
                </Button>
              ) : null}
            </Inline>
          </div>
        ))}
        {listing.coParents.length === 0 && listing.invites.length === 0 ? (
          <div role="listitem">
            <Text size="sm" tone="muted">
              {t("No co-parents yet. Add a partner so they can post updates too.")}
            </Text>
          </div>
        ) : null}
      </Stack>

      {props.isOwner ? <InviteCoParentForm babyId={props.babyId} onInvite={invite} /> : null}
    </Stack>
  );
}
