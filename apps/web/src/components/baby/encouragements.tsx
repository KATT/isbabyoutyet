import { Form, useZodForm } from "@/components/Form";
import { Button } from "@workspace/ui/components/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation } from "convex/react";
import { Send } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";

type EncouragementFormProps = {
  babyId: Id<"baby">;
  babyName: string;
};

const MAX_NAME_LENGTH = 50;
const STORAGE_KEY_NAME = "encouragement-author-name";
const STORAGE_KEY_VISITOR_ID = "encouragement-visitor-id";

// Get or create a unique visitor ID (immutable once created) - client-side only
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let visitorId = localStorage.getItem(STORAGE_KEY_VISITOR_ID);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY_VISITOR_ID, visitorId);
  }
  return visitorId;
}

// Trim before validating, so whitespace-only input doesn't pass "required"
const encouragementSchema = z.object({
  authorName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or less`),
  message: z.string().trim().min(1, "Message is required"),
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
        <p className="text-3xl" aria-hidden="true">
          💛
        </p>
        <h3 className="mt-2 text-xl font-extrabold text-foreground">Send some love</h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
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
