import { Button } from "@workspace/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { format, parseISO } from "date-fns";
import {
  Activity,
  Baby,
  Calendar,
  Camera,
  CheckCircle,
  ChevronDown,
  Clock,
  Hospital,
  MessageSquarePlus,
  Trash2,
  Upload,
} from "lucide-react";
import type * as React from "react";
import { useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import {
  getCurrentStatus,
  getStatusLabel,
  getStatusMessage,
  type BabyData,
  type BabyStatus,
  type BabyUpdate,
  type BabyUpdateHandler,
  type Maybe,
} from "@workspace/convex/src/types";
import { parseDate, THEME_OPTIONS } from "./utils";

type DueDateEditorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

export function DueDateEditor({ baby, onUpdate }: DueDateEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newDate, setNewDate] = useState(() => {
    const date = parseDate(baby.dueDate);
    return format(date, "yyyy-MM-dd");
  });
  const [isLoading, setIsLoading] = useState(false);

  const currentDateFormatted = format(parseDate(baby.dueDate), "yyyy-MM-dd");
  const hasChanges = newDate !== currentDateFormatted;

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80"
        onInteractOutside={(e) => {
          const activeElement = document.activeElement;
          if (
            activeElement?.tagName === "INPUT" &&
            (activeElement as HTMLInputElement).type === "date"
          ) {
            e.preventDefault();
          }
        }}
      >
        <Input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="mb-3"
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.stopPropagation()}
        />
        <div className="flex gap-2 justify-end">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              const date = parseDate(baby.dueDate);
              setNewDate(format(date, "yyyy-MM-dd"));
              setIsEditing(false);
            }}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={async (e) => {
              e.stopPropagation();
              if (hasChanges) {
                setIsLoading(true);
                try {
                  const dateObj = parseISO(newDate);
                  const dateString = dateObj.toISOString();
                  await onUpdate({ dueDate: dateString });
                  setIsEditing(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to update due date");
                } finally {
                  setIsLoading(false);
                }
              } else {
                setIsEditing(false);
              }
            }}
            size="sm"
            disabled={isLoading || !hasChanges}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type StatusDateEditorProps = {
  status: Exclude<BabyStatus["type"], "not_yet">;
  currentDate: string;
  onUpdate: BabyUpdateHandler;
};

export function StatusDateEditor({ status, currentDate, onUpdate }: StatusDateEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newDateTime, setNewDateTime] = useState(() => {
    return formatLocalDateTime(currentDate);
  });
  const [isLoading, setIsLoading] = useState(false);

  const currentDateTimeFormatted = formatLocalDateTime(currentDate);
  const hasChanges = newDateTime !== currentDateTimeFormatted;

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Clock className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <Input
          type="datetime-local"
          value={newDateTime}
          onChange={(e) => setNewDateTime(e.target.value)}
          className="mb-3"
        />
        <div className="flex gap-2 justify-end">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setNewDateTime(formatLocalDateTime(currentDate));
              setIsEditing(false);
            }}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={async (e) => {
              e.stopPropagation();
              if (hasChanges) {
                setIsLoading(true);
                try {
                  const dateObj = parseISO(newDateTime);
                  const dateString = dateObj.toISOString();
                  await onUpdate(buildStatusDatePatch({ status, dateString }));

                  setIsEditing(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to update status date");
                } finally {
                  setIsLoading(false);
                }
              } else {
                setIsEditing(false);
              }
            }}
            size="sm"
            disabled={isLoading || !hasChanges}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type NameEditorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

export function NameEditor({ baby, onUpdate }: NameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(baby.name);
  const [isLoading, setIsLoading] = useState(false);

  const hasChanges = newName.trim() !== baby.name.trim();

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Baby name"
          className="mb-3"
          onKeyDown={async (e) => {
            if (e.key === "Enter" && hasChanges) {
              e.preventDefault();
              setIsLoading(true);
              try {
                await onUpdate({ name: newName.trim() });
                setIsEditing(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to update name");
              } finally {
                setIsLoading(false);
              }
            } else if (e.key === "Escape") {
              setNewName(baby.name);
              setIsEditing(false);
            }
          }}
        />
        <div className="flex gap-2 justify-end">
          <Button
            onClick={() => {
              setNewName(baby.name);
              setIsEditing(false);
            }}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (hasChanges) {
                setIsLoading(true);
                try {
                  await onUpdate({ name: newName.trim() });
                  setIsEditing(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to update name");
                } finally {
                  setIsLoading(false);
                }
              } else {
                setIsEditing(false);
              }
            }}
            size="sm"
            disabled={isLoading || !hasChanges}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ThemeSelectorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

export function ThemeSelector({ baby, onUpdate }: ThemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Change
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <div className="flex flex-col gap-1">
          {THEME_OPTIONS.map((option) => (
            <Button
              key={option.value ?? "default"}
              variant={baby.theme === option.value ? "default" : "ghost"}
              size="sm"
              className="justify-start gap-2"
              disabled={isLoading}
              onClick={async () => {
                setIsLoading(true);
                try {
                  await onUpdate({ theme: option.value });
                  setIsOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to update theme");
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              <div className="flex gap-0.5">
                {option.colors.map((color, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-sm border border-border/50"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              {option.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ClearCurrentStatusButtonProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

export function ClearCurrentStatusButton({ baby, onUpdate }: ClearCurrentStatusButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const currentStatus = getCurrentStatus(baby);

  if (currentStatus.type === "not_yet") {
    return null;
  }

  return (
    <Button
      onClick={async () => {
        setIsLoading(true);
        try {
          await onUpdate(buildStatusDatePatch({ status: currentStatus.type, dateString: null }));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to clear current status");
        } finally {
          setIsLoading(false);
        }
      }}
      disabled={isLoading}
      variant="outline"
    >
      <Trash2 className="w-4 h-4" />
      Clear status
    </Button>
  );
}

type PostUpdateEditorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

type PostUpdateSelection = "keep_current" | Exclude<BabyStatus["type"], "not_yet">;

type PostUpdateOption = {
  value: PostUpdateSelection;
  label: string;
};

export function PostUpdateEditor({ baby, onUpdate }: PostUpdateEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<PostUpdateSelection>("keep_current");
  const [message, setMessage] = useState("");
  const [lastAutofillMessage, setLastAutofillMessage] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [dateTime, setDateTime] = useState(() => formatLocalDateTime(new Date().toISOString()));
  const [isLoading, setIsLoading] = useState(false);

  const currentStatus = getCurrentStatus(baby);
  const statusOptions = useMemo(
    () => getPostUpdateOptions(currentStatus.type),
    [currentStatus.type],
  );
  const currentStatusMessage = getStatusMessage(baby, currentStatus.type) ?? "";

  function resetForm() {
    setSelectedStatus("keep_current");
    setMessage(currentStatusMessage);
    setLastAutofillMessage(currentStatusMessage);
    setDateTime(formatLocalDateTime(new Date().toISOString()));
    setIsAdvancedOpen(false);
  }

  const targetStatus = selectedStatus === "keep_current" ? currentStatus.type : selectedStatus;
  const targetStatusMessage = getStatusMessage(baby, targetStatus) ?? "";
  const trimmedMessage = message.trim();
  const normalizedCurrentMessage = targetStatusMessage.trim();
  const isStatusChanging = selectedStatus !== "keep_current";
  const isMessageChanging = trimmedMessage !== normalizedCurrentMessage;
  const canSubmit = isStatusChanging || isMessageChanging;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setIsOpen(nextOpen);
        if (nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <MessageSquarePlus className="w-4 h-4" />
          Post update
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Post update</DialogTitle>
          <DialogDescription>
            Share a new update and optionally change the baby&apos;s current status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="post-update-message">Message</Label>
            <Textarea
              id="post-update-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={getMessagePlaceholder(currentStatus.type)}
              className="min-h-28"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-update-status">Status</Label>
            <p className="text-sm text-muted-foreground">
              Current: {getStatusLabel(currentStatus.type)}
            </p>
            <Select
              value={selectedStatus}
              onValueChange={(value: PostUpdateSelection) => {
                const nextMessage = getMessageForSelection({
                  baby,
                  currentStatus,
                  selectedStatus: value,
                });
                if (message.trim() === lastAutofillMessage.trim()) {
                  setMessage(nextMessage);
                }
                setLastAutofillMessage(nextMessage);
                setSelectedStatus(value);
              }}
            >
              <SelectTrigger id="post-update-status" className="w-full">
                <SelectValue placeholder="Choose what this update does" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose keep current status if this is just a message.
            </p>
          </div>

          {isStatusChanging && (
            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="px-0 text-sm">
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isAdvancedOpen ? "rotate-180" : ""}`}
                  />
                  Advanced options
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <Label htmlFor="post-update-time">When did this happen?</Label>
                <Input
                  id="post-update-time"
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Changing status will notify subscribers automatically.
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            disabled={isLoading || !canSubmit}
            onClick={async () => {
              setIsLoading(true);
              try {
                await onUpdate(
                  buildPostUpdatePatch({
                    currentStatus,
                    selectedStatus,
                    message: trimmedMessage,
                    dateTime,
                  }),
                );
                setIsOpen(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to post update");
              } finally {
                setIsLoading(false);
              }
            }}
          >
            {isStatusChanging ? "Post update and change status" : "Post update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PhotoUploaderProps = {
  babyId: Id<"baby">;
  photoUrl: string | null;
};

export function PhotoUploader({ babyId, photoUrl }: PhotoUploaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.baby.generateUploadUrl);
  const updatePhoto = useMutation(api.baby.updatePhoto);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setIsUploading(true);

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl({ babyId });

      // Upload file to Convex storage
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const { storageId } = await response.json();

      // Save the photo ID to the baby record
      await updatePhoto({ babyId, photoId: storageId });

      toast.success("Photo uploaded successfully");
      setIsOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async () => {
    setIsUploading(true);
    try {
      await updatePhoto({ babyId, photoId: null });
      toast.success("Photo removed");
      setIsOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setIsUploading(false);
    }
  };

  const displayUrl = previewUrl || photoUrl;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {photoUrl ? "Change" : "Add"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          {displayUrl && (
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border">
              <img
                src={displayUrl}
                alt="Baby photo preview"
                width={320}
                height={320}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? "Uploading..." : photoUrl ? "Replace" : "Upload"}
            </Button>

            {photoUrl && (
              <Button
                onClick={handleRemovePhoto}
                disabled={isUploading}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Supported: JPG, PNG, GIF, WebP
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getPostUpdateOptions(currentStatus: BabyStatus["type"]): PostUpdateOption[] {
  switch (currentStatus) {
    case "not_yet":
      return [
        { value: "keep_current", label: "Keep current status" },
        { value: "labor_started", label: "Change to Labour started" },
        { value: "gone_to_hospital", label: "Change to Gone to hospital" },
        { value: "born", label: "Change to Baby born" },
      ];
    case "labor_started":
      return [
        { value: "keep_current", label: "Keep current status" },
        { value: "gone_to_hospital", label: "Change to Gone to hospital" },
        { value: "born", label: "Change to Baby born" },
      ];
    case "gone_to_hospital":
      return [
        { value: "keep_current", label: "Keep current status" },
        { value: "born", label: "Change to Baby born" },
      ];
    case "born":
      return [{ value: "keep_current", label: "Keep current status" }];
  }
}

function buildPostUpdatePatch(opts: {
  currentStatus: BabyStatus;
  selectedStatus: PostUpdateSelection;
  message: string;
  dateTime: string;
}): BabyUpdate {
  const nextStatus =
    opts.selectedStatus === "keep_current" ? opts.currentStatus.type : opts.selectedStatus;
  const normalizedMessage = opts.message || null;
  const patch: BabyUpdate = buildStatusMessagePatch({
    status: nextStatus,
    message: normalizedMessage,
  });

  if (opts.selectedStatus === "keep_current") {
    return patch;
  }

  return {
    ...patch,
    ...buildStatusDatePatch({
      status: opts.selectedStatus,
      dateString: parseISO(opts.dateTime).toISOString(),
    }),
  };
}

function buildStatusMessagePatch(opts: {
  status: BabyStatus["type"];
  message: Maybe<string>;
}): BabyUpdate {
  switch (opts.status) {
    case "not_yet":
      return { notYetMessage: opts.message ?? null };
    case "labor_started":
      return { laborStartedMessage: opts.message ?? null };
    case "gone_to_hospital":
      return { hospitalMessage: opts.message ?? null };
    case "born":
      return { babyBornMessage: opts.message ?? null };
  }
}

function buildStatusDatePatch(opts: {
  status: Exclude<BabyStatus["type"], "not_yet">;
  dateString: Maybe<string>;
}): BabyUpdate {
  switch (opts.status) {
    case "labor_started":
      return { laborStarted: opts.dateString ?? null };
    case "gone_to_hospital":
      return { wentToHospital: opts.dateString ?? null };
    case "born":
      return { babyBorn: opts.dateString ?? null };
  }
}

function getMessageForSelection(opts: {
  baby: BabyData;
  currentStatus: BabyStatus;
  selectedStatus: PostUpdateSelection;
}): string {
  const status =
    opts.selectedStatus === "keep_current" ? opts.currentStatus.type : opts.selectedStatus;
  return getStatusMessage(opts.baby, status) ?? "";
}

function getMessagePlaceholder(status: BabyStatus["type"]): string {
  switch (status) {
    case "not_yet":
      return "Share an update with family and friends...";
    case "labor_started":
      return "How are things progressing?";
    case "gone_to_hospital":
      return "Want to share a quick update from the hospital?";
    case "born":
      return "Share the good news...";
  }
}

function formatLocalDateTime(dateString: string): string {
  const date = parseDate(dateString);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

// Re-export icons for convenience
export { Activity, Baby, Calendar, Camera, CheckCircle, Hospital };
