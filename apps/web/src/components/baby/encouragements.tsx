import { Form, useZodForm } from "@/components/Form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation, usePaginatedQuery } from "convex/react";
import { Check, Heart, Pencil, Send, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { z } from "zod";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";

type EncouragementFormProps = {
  babyId: Id<"baby">;
  babyName: string;
};

const MAX_NAME_LENGTH = 50;
const PAGE_SIZE = 20;
const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY_NAME = "encouragement-author-name";
const STORAGE_KEY_VISITOR_ID = "encouragement-visitor-id";

// Get or create a unique visitor ID (immutable once created) - client-side only
function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let visitorId = localStorage.getItem(STORAGE_KEY_VISITOR_ID);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY_VISITOR_ID, visitorId);
  }
  return visitorId;
}

const encouragementSchema = z.object({
  authorName: z
    .string()
    .min(1, "Name is required")
    .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or less`),
  message: z.string().min(1, "Message is required"),
});

export function EncouragementForm(props: EncouragementFormProps) {
  const createEncouragement = useMutation(api.encouragements.create);

  const form = useZodForm({
    schema: encouragementSchema,
    defaultValues: {
      authorName: "",
      message: "",
    },
  });

  // Load saved name from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedName = localStorage.getItem(STORAGE_KEY_NAME);
    if (savedName) {
      form.setValue("authorName", savedName);
    }
  }, [form]);

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
          <Heart className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Send Encouragement</h3>
        <p className="text-sm text-muted-foreground">
          Leave a message of support for {props.babyName}'s family
        </p>
      </div>

      <Form
        form={form}
        handleSubmit={async (values) => {
          const authorName = values.authorName.trim();
          // Save name to localStorage for next time
          localStorage.setItem(STORAGE_KEY_NAME, authorName);

          const promise = createEncouragement({
            babyId: props.babyId,
            authorName,
            message: values.message.trim(),
            visitorId: getVisitorId(),
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            locale: typeof navigator !== "undefined" ? navigator.language : undefined,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }).then(async (it) => {
            if (import.meta.env.DEV) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            return it;
          });

          toast.promise(promise, {
            loading: "Sending your encouragement...",
            success: "Your kind words have been sent! 💕",
            error: (err) => (err instanceof Error ? err.message : "Failed to send encouragement"),
          });
          form.reset({ authorName, message: "" });
          await promise;
        }}
      >
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="authorName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your name</FormLabel>
                <FormControl>
                  <Input placeholder="Your name" maxLength={MAX_NAME_LENGTH} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Write your message of encouragement..."
                    className="min-h-24"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
            <Send className="w-4 h-4" />
            {form.formState.isSubmitting ? "Sending..." : "Send Encouragement"}
          </Button>
        </div>
      </Form>
    </div>
  );
}

type EncouragementsFeedProps = {
  babyId: Id<"baby">;
  isOwner: boolean;
};

function getRelativeTimeFromTimestamp(timestamp: number): string {
  const now = Date.now();
  const diffInSeconds = Math.floor((timestamp - now) / 1000);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const intervals = [
    { unit: "year" as const, seconds: 31536000 },
    { unit: "month" as const, seconds: 2592000 },
    { unit: "week" as const, seconds: 604800 },
    { unit: "day" as const, seconds: 86400 },
    { unit: "hour" as const, seconds: 3600 },
    { unit: "minute" as const, seconds: 60 },
  ];

  for (const { unit, seconds } of intervals) {
    const interval = Math.floor(Math.abs(diffInSeconds) / seconds);
    if (interval >= 1) {
      return rtf.format(diffInSeconds > 0 ? interval : -interval, unit);
    }
  }

  return rtf.format(0, "second");
}

function isWithinEditWindow(createdAt: number): boolean {
  return Date.now() - createdAt < EDIT_WINDOW_MS;
}

type EncouragementItemProps = {
  encouragement: {
    _id: Id<"encouragements">;
    authorName: string;
    message: string;
    createdAt: number;
    visitorId?: string;
  };
  isOwner: boolean;
  currentVisitorId: string;
  onDelete: (id: Id<"encouragements">, visitorId?: string) => Promise<void>;
  onUpdate: (id: Id<"encouragements">, visitorId: string, message: string) => Promise<void>;
};

function EncouragementItem(props: EncouragementItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editMessage, setEditMessage] = useState(props.encouragement.message);
  const [isSaving, setIsSaving] = useState(false);

  const isOwnPost = props.encouragement.visitorId === props.currentVisitorId;
  const canEdit = isOwnPost && isWithinEditWindow(props.encouragement.createdAt);
  const canDelete = props.isOwner || canEdit;

  const handleSave = async () => {
    if (!editMessage.trim()) {
      toast.error("Message cannot be empty");
      return;
    }
    setIsSaving(true);
    try {
      await props.onUpdate(props.encouragement._id, props.currentVisitorId, editMessage);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMessage(props.encouragement.message);
    setIsEditing(false);
  };

  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border/50 relative group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground truncate">
              {props.encouragement.authorName}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {getRelativeTimeFromTimestamp(props.encouragement.createdAt)}
            </span>
            {isOwnPost && <span className="text-xs text-primary/70 shrink-0">(you)</span>}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                className="min-h-20"
                disabled={isSaving}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  <Check className="w-3 h-3" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
                  <X className="w-3 h-3" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-primary">
              <Streamdown>{props.encouragement.message}</Streamdown>
            </div>
          )}
        </div>

        {!isEditing && (canEdit || canDelete) && (
          <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </Button>
            )}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Encouragement?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this encouragement from{" "}
                      {props.encouragement.authorName}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        props.onDelete(
                          props.encouragement._id,
                          canEdit ? props.currentVisitorId : undefined,
                        )
                      }
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function EncouragementsFeed(props: EncouragementsFeedProps) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.encouragements.listByBaby,
    { babyId: props.babyId },
    { initialNumItems: PAGE_SIZE },
  );
  const removeEncouragement = useMutation(api.encouragements.remove);
  const updateEncouragement = useMutation(api.encouragements.update);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [currentVisitorId, setCurrentVisitorId] = useState("");

  // Get visitor ID on client side
  useEffect(() => {
    setCurrentVisitorId(getVisitorId());
  }, []);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    if (status !== "CanLoadMore") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore(PAGE_SIZE);
        }
      },
      { threshold: 0.1 },
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [status, loadMore]);

  const handleDelete = async (encouragementId: Id<"encouragements">, visitorId?: string) => {
    try {
      await removeEncouragement({ encouragementId, visitorId });
      toast.success("Encouragement removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove encouragement");
    }
  };

  const handleUpdate = async (
    encouragementId: Id<"encouragements">,
    visitorId: string,
    message: string,
  ) => {
    try {
      await updateEncouragement({ encouragementId, visitorId, message });
      toast.success("Encouragement updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update encouragement");
      throw error;
    }
  };

  if (status === "LoadingFirstPage") {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Spinner className="mx-auto mb-2" />
        <p>Loading encouragements...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
          <Heart className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground">No encouragements yet</p>
        <p className="text-sm text-muted-foreground/70">Be the first to send some love!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Encouragements</h3>
      </div>

      <div className="space-y-3">
        {results.map((encouragement) => (
          <EncouragementItem
            key={encouragement._id}
            encouragement={encouragement}
            isOwner={props.isOwner}
            currentVisitorId={currentVisitorId}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        ))}

        {/* Infinite scroll trigger */}
        <div ref={loadMoreRef} className="py-2">
          {status === "LoadingMore" && (
            <div className="text-center text-muted-foreground">
              <Spinner className="mx-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
