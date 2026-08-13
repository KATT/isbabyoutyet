import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { toast } from "sonner";
import { CircleNotch, UserMinus, X } from "@phosphor-icons/react";

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
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!props.isOwner || busy) return;
    setBusy(true);
    try {
      const result = await invite({ babyId: props.babyId, email });
      setEmail("");
      toast.success(
        result.status === "added"
          ? "Co-parent added — they can manage this page now"
          : "Invite sent — they'll get access after signing up with that email",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 w-full">
      {listing === undefined ? (
        <p className="text-sm text-muted-foreground">Loading co-parents…</p>
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
                  aria-label={`Remove ${row.email}`}
                  onClick={() => {
                    void removeCoParent({ coParentId: row._id })
                      .then(() => toast.success("Co-parent removed"))
                      .catch((error: unknown) => {
                        toast.error(error instanceof Error ? error.message : "Could not remove");
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
                <div className="text-muted-foreground">Invite pending</div>
              </div>
              {props.isOwner ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Cancel invite to ${row.email}`}
                  onClick={() => {
                    void cancelInvite({ inviteId: row._id })
                      .then(() => toast.success("Invite cancelled"))
                      .catch((error: unknown) => {
                        toast.error(error instanceof Error ? error.message : "Could not cancel");
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
              No co-parents yet. Add a partner so they can post updates too.
            </li>
          ) : null}
        </ul>
      )}

      {props.isOwner ? (
        <form onSubmit={onInvite} className="flex gap-2">
          <Input
            type="email"
            placeholder="partner@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={busy || !email.trim()}>
            {busy ? <CircleNotch className="w-4 h-4 animate-spin" /> : "Add"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
