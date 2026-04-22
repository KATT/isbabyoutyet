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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { cn } from "@workspace/ui/lib/utils";
import { useConvex, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import MDEditor, { commands } from "@uiw/react-md-editor";
import type { ICommand } from "@uiw/react-md-editor";
import MarkdownPreview from "@uiw/react-markdown-preview";
import {
  Check,
  Heart,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";
import {
  createMarkdownImage,
  extractEncouragementImageIds,
  replaceEncouragementImageUrlsWithTokens,
} from "@workspace/convex/src/encouragementMarkdown";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

type EncouragementFormProps = {
  babyId: Id<"baby">;
  babyName: string;
};

const MAX_NAME_LENGTH = 50;
const PAGE_SIZE = 20;
const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY_NAME = "encouragement-author-name";
const STORAGE_KEY_VISITOR_ID = "encouragement-visitor-id";
const MARKDOWN_PLACEHOLDER = `Write your message of encouragement...

You can use **bold**, *italic*, lists, links, and images.`;

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

type EncouragementFormValues = z.infer<typeof encouragementSchema>;

function MarkdownMessage(props: {
  markdown: string;
  className?: string;
  emptyState?: string;
}) {
  if (!props.markdown.trim()) {
    return <p className="text-sm text-muted-foreground">{props.emptyState ?? "Nothing to preview yet."}</p>;
  }

  return (
    <MarkdownPreview
      source={props.markdown}
      wrapperElement={{ "data-color-mode": "light" }}
      className={cn(
        "bg-transparent text-sm text-foreground prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-primary [&_.wmde-markdown]:bg-transparent [&_.wmde-markdown]:text-foreground [&_.wmde-markdown]:p-0 [&_.wmde-markdown-var]:bg-transparent",
        props.className,
      )}
    />
  );
}

async function uploadEncouragementImage(opts: {
  babyId: Id<"baby">;
  file: File;
  generateImageUploadUrl: (args: { babyId: Id<"baby"> }) => Promise<string>;
}) {
  const uploadUrl = await opts.generateImageUploadUrl({ babyId: opts.babyId });
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": opts.file.type },
    body: opts.file,
  });

  if (!response.ok) {
    throw new Error("Failed to upload image");
  }

  const body = (await response.json()) as { storageId?: string };
  if (!body.storageId) {
    throw new Error("Upload did not return a storage ID");
  }

  return body.storageId as Id<"_storage">;
}

type MarkdownComposerProps = {
  babyId: Id<"baby">;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyPreviewMessage?: string;
  onImageUploaded?: (image: { imageId: Id<"_storage">; imageUrl: string }) => void;
};

function MarkdownComposer(props: MarkdownComposerProps) {
  const convex = useConvex();
  const generateImageUploadUrl = useMutation(api.encouragements.generateImageUploadUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("write");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const toolbarCommands = useMemo<ICommand[]>(
    () => [
      commands.bold,
      commands.italic,
      commands.strikethrough,
      commands.divider,
      commands.link,
      commands.quote,
      commands.code,
      commands.codeBlock,
      commands.divider,
      commands.unorderedListCommand,
      commands.orderedListCommand,
    ],
    [],
  );

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }

    setIsUploadingImage(true);
    try {
      const storageId = await uploadEncouragementImage({
        babyId: props.babyId,
        file,
        generateImageUploadUrl,
      });
      const altText = file.name.replace(/\.[^.]+$/, "") || "Encouragement image";
      const imageUrls = await convex.query(api.encouragements.getImageUrls, {
        imageIds: [storageId],
      });
      const imageUrl = imageUrls[storageId];
      if (!imageUrl) {
        throw new Error("Uploaded image is not available yet");
      }

      const imageMarkdown = createMarkdownImage({ url: imageUrl, altText });
      const separator = props.value.trim().length === 0 ? "" : "\n\n";
      props.onChange(`${props.value}${separator}${imageMarkdown}`);
      props.onImageUploaded?.({
        imageId: storageId,
        imageUrl,
      });
      setActiveTab("write");
      toast.success("Image attached");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={props.disabled || isUploadingImage}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleUpload(file);
          }
        }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <TabsList className="grid w-auto grid-cols-2">
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={props.disabled || isUploadingImage}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploadingImage ? (
              <LoaderCircle className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
            {isUploadingImage ? "Uploading image..." : "Attach image"}
          </Button>
        </div>

        <TabsContent value="write">
          <div data-color-mode="light">
            <MDEditor
              value={props.value}
              onChange={(value) => props.onChange(value ?? "")}
              preview="edit"
              visibleDragbar={false}
              height={260}
              hideToolbar={false}
              commands={toolbarCommands}
              extraCommands={[]}
              textareaProps={{
                placeholder: MARKDOWN_PLACEHOLDER,
                disabled: props.disabled || isUploadingImage,
              }}
              previewOptions={{
                wrapperElement: { "data-color-mode": "light" },
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <div className="min-h-[260px] rounded-md border border-input bg-background px-4 py-3">
            <MarkdownMessage
              markdown={props.value}
              emptyState={props.emptyPreviewMessage ?? "Nothing to preview yet."}
            />
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Supports Markdown, links, and image attachments. Images are inserted into your message.
      </p>
    </div>
  );
}

export function EncouragementForm(props: EncouragementFormProps) {
  const createEncouragement = useMutation(api.encouragements.create);
  const [draftImageIdsByUrl, setDraftImageIdsByUrl] = useState<Record<string, string>>({});

  const form = useZodForm<EncouragementFormValues>({
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
          const normalizedMessage = replaceEncouragementImageUrlsWithTokens({
            markdown: values.message.trim(),
            imageIdsByUrl: draftImageIdsByUrl,
          });
          // Save name to localStorage for next time
          localStorage.setItem(STORAGE_KEY_NAME, authorName);

          const promise = createEncouragement({
            babyId: props.babyId,
            authorName,
            message: normalizedMessage,
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
          setDraftImageIdsByUrl({});
          await promise;
        }}
      >
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="authorName"
            render={(fieldProps) => (
              <FormItem>
                <FormLabel>Your name</FormLabel>
                <FormControl>
                  <Input placeholder="Your name" maxLength={MAX_NAME_LENGTH} {...fieldProps.field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={(fieldProps) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <MarkdownComposer
                    babyId={props.babyId}
                    value={fieldProps.field.value}
                    onChange={fieldProps.field.onChange}
                    disabled={form.formState.isSubmitting}
                    emptyPreviewMessage="Your encouragement preview will appear here."
                    onImageUploaded={(image) => {
                      setDraftImageIdsByUrl((current) => ({
                        ...current,
                        [image.imageUrl]: image.imageId,
                      }));
                    }}
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
  babyId: Id<"baby">;
  encouragement: {
    _id: Id<"encouragements">;
    authorName: string;
    message: string;
    renderedMessage: string;
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
  const [editMessage, setEditMessage] = useState(props.encouragement.renderedMessage);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedImageIdsByUrl, setUploadedImageIdsByUrl] = useState<Record<string, string>>({});
  const imageIds = useMemo(
    () => extractEncouragementImageIds(props.encouragement.message) as Id<"_storage">[],
    [props.encouragement.message],
  );

  const isOwnPost = props.encouragement.visitorId === props.currentVisitorId;
  const canEdit = isOwnPost && isWithinEditWindow(props.encouragement.createdAt);
  const canDelete = props.isOwner || canEdit;

  const resolvedImageIds = useQuery(
    api.encouragements.getImageUrls,
    isEditing && imageIds.length > 0
      ? {
          imageIds,
        }
      : "skip",
  );

  const handleSave = async () => {
    if (!editMessage.trim()) {
      toast.error("Message cannot be empty");
      return;
    }
    if (imageIds.length > 0 && !resolvedImageIds) {
      toast.error("Images are still loading. Please try again in a moment.");
      return;
    }
    setIsSaving(true);
    try {
      const existingImageUrlsById = resolvedImageIds || {};
      const uploadedImageUrlsById = Object.fromEntries(
        Object.entries(uploadedImageIdsByUrl).map(([imageUrl, imageId]) => [imageId, imageUrl]),
      );
      const imageIdsByUrl = Object.fromEntries(
        Object.entries({
          ...existingImageUrlsById,
          ...uploadedImageUrlsById,
        }).flatMap(([imageId, imageUrl]) =>
          imageUrl ? [[imageUrl, imageId]] : [],
        ),
      );
      const normalizedMessage = replaceEncouragementImageUrlsWithTokens({
        markdown: editMessage,
        imageIdsByUrl,
      });
      await props.onUpdate(props.encouragement._id, props.currentVisitorId, normalizedMessage);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMessage(props.encouragement.renderedMessage);
    setUploadedImageIdsByUrl({});
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
              <MarkdownComposer
                babyId={props.babyId}
                value={editMessage}
                onChange={setEditMessage}
                disabled={isSaving}
                emptyPreviewMessage="Your updated encouragement preview will appear here."
                onImageUploaded={(image) => {
                  setUploadedImageIdsByUrl((current) => ({
                    ...current,
                    [image.imageUrl]: image.imageId,
                  }));
                }}
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
            <MarkdownMessage markdown={props.encouragement.renderedMessage} />
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
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </AlertDialogTrigger>
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
            babyId={props.babyId}
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
