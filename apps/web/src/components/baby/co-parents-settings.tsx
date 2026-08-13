import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { Button } from "@workspace/ui/components/button";
import { FormControl, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { toast } from "sonner";
import { CircleNotch, UserMinus, X } from "@phosphor-icons/react";
import * as z from "zod";
import { Form, useZodForm } from "@/components/Form";
import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

export type CoParentsListing = FunctionReturnType<typeof api.coParents.listForBaby>;

function inviteCoParentSchema(t: TranslationFunction) {
  return z.object({
    email: z.string().trim().email(t("Invalid email address")),
  });
}

function InviteCoParentForm(props: {
  onInvite: (email: string) => Promise<{ status: "added" | "invited" }>;
}) {
  const { t } = useI18n();
  const form = useZodForm({
    schema: inviteCoParentSchema(t),
    defaultValues: { email: "" },
  });
  const email = form.watch("email");

  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        const result = await props.onInvite(values.email);
        form.reset({ email: "" });
        toast.success(
          result.status === "added"
            ? t("Co-parent added — they can manage this page now")
            : t("Invite sent — they'll get access after signing up with that email"),
        );
      }}
    >
      <div className="flex gap-2">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input type="email" placeholder="partner@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting || !email.trim()}>
          {form.formState.isSubmitting ? (
            <CircleNotch className="w-4 h-4 animate-spin" />
          ) : (
            t("Add")
          )}
        </Button>
      </div>
    </Form>
  );
}

type CoParentsSettingsViewProps = {
  /** Only the owner can invite/remove; co-parents see a read-only list. */
  isOwner: boolean;
  /** `undefined` while the listing query is loading. */
  listing: CoParentsListing | undefined;
  onInvite: (email: string) => Promise<{ status: "added" | "invited" }>;
  onRemoveCoParent: (coParentId: Id<"babyCoParents">) => Promise<unknown>;
  onCancelInvite: (inviteId: Id<"babyCoParentInvites">) => Promise<unknown>;
};

/**
 * Presentational settings section for inviting co-parents by email and
 * managing membership. Takes all data + actions as props so it can be
 * rendered in tests without a Convex provider.
 */
export function CoParentsSettingsView(props: CoParentsSettingsViewProps) {
  const { t } = useI18n();
  const listing = props.listing;

  return (
    <div className="space-y-3 w-full">
      {listing === undefined ? (
        <p className="text-sm text-muted-foreground">{t("Loading co-parents…")}</p>
      ) : (
        <ul className="space-y-2">
          {listing.coParents.map((row) => (
            <li key={row._id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{row.name || row.email}</div>
                {row.name ? (
                  <div className="text-muted-foreground truncate">{row.email}</div>
                ) : null}
              </div>
              {props.isOwner ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("Remove {{email}}", { email: row.email })}
                  onClick={() => {
                    void props
                      .onRemoveCoParent(row._id)
                      .then(() => toast.success(t("Co-parent removed")))
                      .catch((error: unknown) => {
                        toast.error(error instanceof Error ? error.message : t("Could not remove"));
                      });
                  }}
                >
                  <UserMinus className="w-4 h-4" />
                </Button>
              ) : null}
            </li>
          ))}
          {listing.invites.map((row) => (
            <li key={row._id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{row.email}</div>
                <div className="text-muted-foreground">{t("Invite pending")}</div>
              </div>
              {props.isOwner ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("Cancel invite to {{email}}", { email: row.email })}
                  onClick={() => {
                    void props
                      .onCancelInvite(row._id)
                      .then(() => toast.success(t("Invite cancelled")))
                      .catch((error: unknown) => {
                        toast.error(error instanceof Error ? error.message : t("Could not cancel"));
                      });
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              ) : null}
            </li>
          ))}
          {listing.coParents.length === 0 && listing.invites.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              {t("No co-parents yet. Add a partner so they can post updates too.")}
            </li>
          ) : null}
        </ul>
      )}

      {props.isOwner ? <InviteCoParentForm onInvite={props.onInvite} /> : null}
    </div>
  );
}

type CoParentsSettingsProps = {
  babyId: Id<"baby">;
  /** Only the owner can invite/remove; co-parents see a read-only list. */
  isOwner: boolean;
};

/**
 * Settings section for inviting co-parents by email and managing membership.
 */
export function CoParentsSettings(props: CoParentsSettingsProps) {
  const listing = useQuery(api.coParents.listForBaby, { babyId: props.babyId });
  const invite = useMutation(api.coParents.invite);
  const removeCoParent = useMutation(api.coParents.removeCoParent);
  const cancelInvite = useMutation(api.coParents.cancelInvite);

  return (
    <CoParentsSettingsView
      isOwner={props.isOwner}
      listing={listing}
      onInvite={(email) => invite({ babyId: props.babyId, email })}
      onRemoveCoParent={(coParentId) => removeCoParent({ coParentId })}
      onCancelInvite={(inviteId) => cancelInvite({ inviteId })}
    />
  );
}
