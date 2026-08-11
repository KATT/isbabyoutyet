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
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogTrigger } from "@workspace/ui/components/dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation, usePaginatedQuery } from "convex/react";
import {
  Activity,
  Camera,
  Check,
  CheckCircle,
  Heart,
  Hospital,
  ImagePlus,
  MessageCircleHeart,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";
import type { BabyData, Milestone } from "@workspace/convex/src/types";
import { getVisitorId } from "./encouragements";

const PAGE_SIZE = 20;
const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type TimelineItemData = FunctionReturnType<typeof api.timeline.listByBaby>["page"][number];
type UpdateItemData = Extract<TimelineItemData, { kind: "update" }>;
type EncouragementItemData = Extract<TimelineItemData, { kind: "encouragement" }>;

const MILESTONE_META: Record<Milestone, { label: string; icon: typeof Activity }> = {
  labor_started: { label: "Labour started", icon: Activity },
  gone_to_hospital: { label: "Gone to hospital", icon: Hospital },
  born: { label: "Born!", icon: CheckCircle },
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

// --- Owner composer ---

type UpdateComposerProps = {
  babyId: Id<"baby">;
  baby: BabyData;
  babyName: string;
};

export function UpdateComposer(props: UpdateComposerProps) {
  const postUpdate = useMutation(api.updates.post);
  const generateUploadUrl = useMutation(api.baby.generateUploadUrl);

  const [message, setMessage] = useState("");
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableMilestones = (Object.keys(MILESTONE_META) as Milestone[]).filter((candidate) => {
    if (candidate === "labor_started") return !props.baby.laborStarted;
    if (candidate === "gone_to_hospital") return !props.baby.wentToHospital;
    return !props.baby.babyBorn;
  });

  const canPost = !isPosting && (message.trim().length > 0 || milestone !== null || !!photoFile);

  const clearPhoto = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handlePost = async () => {
    setIsPosting(true);
    try {
      let photoId: Id<"_storage"> | undefined;
      if (photoFile) {
        const uploadUrl = await generateUploadUrl({ babyId: props.babyId });
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": photoFile.type },
          body: photoFile,
        });
        if (!response.ok) {
          throw new Error("Failed to upload photo");
        }
        const uploaded = (await response.json()) as { storageId: Id<"_storage"> };
        photoId = uploaded.storageId;
      }

      await postUpdate({
        babyId: props.babyId,
        message: message.trim() || undefined,
        milestone: milestone ?? undefined,
        photoId,
      });

      toast.success("Update posted!");
      setMessage("");
      setMilestone(null);
      clearPhoto();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post update");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircleHeart className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Post an update</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Share how it's going — everyone following {props.babyName}'s page will see it.
      </p>

      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Share an update with everyone…"
        className="min-h-20"
        disabled={isPosting}
      />

      {photoPreviewUrl && (
        <div className="relative w-fit">
          <img
            src={photoPreviewUrl}
            alt="Photo to post"
            className="max-h-40 rounded-lg border border-border object-cover"
          />
          <Button
            variant="secondary"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow"
            onClick={clearPhoto}
            disabled={isPosting}
            aria-label="Remove photo"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {availableMilestones.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Mark a milestone:</span>
          {availableMilestones.map((candidate) => {
            const meta = MILESTONE_META[candidate];
            const MilestoneIcon = meta.icon;
            const isSelected = milestone === candidate;
            return (
              <Button
                key={candidate}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setMilestone(isSelected ? null : candidate)}
                disabled={isPosting}
              >
                <MilestoneIcon className="w-3.5 h-3.5" />
                {meta.label}
              </Button>
            );
          })}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPosting}
        >
          <ImagePlus className="w-4 h-4" />
          {photoFile ? "Change photo" : "Add photo"}
        </Button>
        <Button onClick={handlePost} disabled={!canPost}>
          <Send className="w-4 h-4" />
          {isPosting ? "Posting..." : "Post update"}
        </Button>
      </div>
    </div>
  );
}

// --- Timeline items ---

type UpdateTimelineItemProps = {
  item: UpdateItemData;
  babyName: string;
  isOwner: boolean;
  onDelete: (updateId: Id<"updates">) => Promise<void>;
};

function UpdateTimelineItem(props: UpdateTimelineItemProps) {
  const update = props.item.update;
  const milestoneMeta = update.milestone ? MILESTONE_META[update.milestone] : null;
  const MilestoneIcon = milestoneMeta?.icon ?? Camera;

  return (
    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 border-l-4 border-l-primary relative group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-foreground truncate">{props.babyName}'s family</span>
            {milestoneMeta ? (
              <Badge className="shrink-0">
                <MilestoneIcon className="w-3 h-3" />
                {milestoneMeta.label}
              </Badge>
            ) : update.photoId ? (
              <Badge variant="secondary" className="shrink-0">
                <Camera className="w-3 h-3" />
                New photo
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0">
                Update
              </Badge>
            )}
            <span className="text-xs text-muted-foreground shrink-0">
              {getRelativeTimeFromTimestamp(props.item.postedAt)}
            </span>
          </div>

          {update.message && (
            <div className="text-sm text-foreground/90 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-primary">
              <Streamdown>{update.message}</Streamdown>
            </div>
          )}

          {update.photoUrl && (
            <TimelinePhoto photoUrl={update.photoUrl} thumbnailUrl={update.thumbnailUrl} />
          )}
        </div>

        {props.isOwner && (
          <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
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
                  <AlertDialogTitle>Delete update?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {update.milestone
                      ? "This also unmarks the milestone on the status card."
                      : "This removes the update from the timeline."}{" "}
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => props.onDelete(update._id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
}

type TimelinePhotoProps = {
  photoUrl: string;
  thumbnailUrl: string | null;
};

function TimelinePhoto(props: TimelinePhotoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const inlineUrl = props.thumbnailUrl ?? props.photoUrl;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <button className="mt-2 block cursor-pointer overflow-hidden rounded-lg border border-border transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary">
            <img
              src={inlineUrl}
              alt="Baby update"
              className="max-h-64 w-auto object-cover"
              loading="lazy"
            />
          </button>
        }
      />
      <DialogContent className="max-w-3xl p-0 border-0 bg-transparent shadow-none">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute -top-12 right-0 p-2 rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-background transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <img
          src={props.photoUrl}
          alt="Baby update"
          className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
        />
      </DialogContent>
    </Dialog>
  );
}

type EncouragementTimelineItemProps = {
  item: EncouragementItemData;
  isOwner: boolean;
  currentVisitorId: string;
  onDelete: (id: Id<"encouragements">, visitorId?: string) => Promise<void>;
  onUpdate: (id: Id<"encouragements">, visitorId: string, message: string) => Promise<void>;
};

function EncouragementTimelineItem(props: EncouragementTimelineItemProps) {
  const encouragement = props.item.encouragement;
  const [isEditing, setIsEditing] = useState(false);
  const [editMessage, setEditMessage] = useState(encouragement.message);
  const [isSaving, setIsSaving] = useState(false);

  const isOwnPost = encouragement.visitorId === props.currentVisitorId;
  const canEdit = isOwnPost && isWithinEditWindow(encouragement.createdAt);
  const canDelete = props.isOwner || canEdit;

  const handleSave = async () => {
    if (!editMessage.trim()) {
      toast.error("Message cannot be empty");
      return;
    }
    setIsSaving(true);
    try {
      await props.onUpdate(encouragement._id, props.currentVisitorId, editMessage);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMessage(encouragement.message);
    setIsEditing(false);
  };

  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border/50 relative group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground truncate">{encouragement.authorName}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {getRelativeTimeFromTimestamp(encouragement.createdAt)}
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
              <Streamdown>{encouragement.message}</Streamdown>
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
                      {encouragement.authorName}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        props.onDelete(
                          encouragement._id,
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

// --- Feed ---

type TimelineFeedProps = {
  babyId: Id<"baby">;
  babyName: string;
  isOwner: boolean;
};

export function TimelineFeed(props: TimelineFeedProps) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.timeline.listByBaby,
    { babyId: props.babyId },
    { initialNumItems: PAGE_SIZE },
  );
  const removeUpdate = useMutation(api.updates.remove);
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

  const handleDeleteUpdate = async (updateId: Id<"updates">) => {
    try {
      await removeUpdate({ updateId });
      toast.success("Update removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove update");
    }
  };

  const handleDeleteEncouragement = async (
    encouragementId: Id<"encouragements">,
    visitorId?: string,
  ) => {
    try {
      await removeEncouragement({ encouragementId, visitorId });
      toast.success("Encouragement removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove encouragement");
    }
  };

  const handleUpdateEncouragement = async (
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
        <p>Loading the timeline...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
          <Heart className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground">Nothing here yet</p>
        <p className="text-sm text-muted-foreground/70">
          Updates and encouragements will show up here!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Updates & encouragements</h3>
      </div>

      <div className="space-y-3">
        {results.map((item) =>
          item.kind === "update" ? (
            <UpdateTimelineItem
              key={item._id}
              item={item}
              babyName={props.babyName}
              isOwner={props.isOwner}
              onDelete={handleDeleteUpdate}
            />
          ) : (
            <EncouragementTimelineItem
              key={item._id}
              item={item}
              isOwner={props.isOwner}
              currentVisitorId={currentVisitorId}
              onDelete={handleDeleteEncouragement}
              onUpdate={handleUpdateEncouragement}
            />
          ),
        )}

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
