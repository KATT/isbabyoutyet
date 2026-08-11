import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { format, parseISO } from "date-fns";
import {
  Activity,
  Baby,
  Calendar,
  Camera,
  CheckCircle,
  Clock,
  Hospital,
  Trash2,
  Upload,
} from "lucide-react";
import type * as React from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { BabyData, BabyUpdateHandler, Maybe } from "@workspace/convex/src/types";
import { parseDate, THEME_OPTIONS } from "./utils";
import { useMutation } from "convex/react";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";

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
    <Popover
      open={isEditing}
      onOpenChange={(open, eventDetails) => {
        // Keep the popover open while the native date picker (rendered outside
        // the popover) is in use; Base UI replaces onInteractOutside with
        // onOpenChange reasons + eventDetails.cancel()
        if (
          !open &&
          (eventDetails.reason === "outside-press" || eventDetails.reason === "focus-out")
        ) {
          const activeElement = document.activeElement;
          if (
            activeElement?.tagName === "INPUT" &&
            (activeElement as HTMLInputElement).type === "date"
          ) {
            eventDetails.cancel();
            return;
          }
        }
        setIsEditing(open);
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            Edit
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80">
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
  baby: BabyData;
  status: "labor_started" | "gone_to_hospital" | "born";
  currentDate: string;
  onUpdate: BabyUpdateHandler;
};

export function StatusDateEditor({
  baby: _baby,
  status,
  currentDate,
  onUpdate,
}: StatusDateEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newDateTime, setNewDateTime] = useState(() => {
    const date = parseDate(currentDate);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  });
  const [isLoading, setIsLoading] = useState(false);

  const currentDateTimeFormatted = (() => {
    const date = parseDate(currentDate);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  })();
  const hasChanges = newDateTime !== currentDateTimeFormatted;

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Clock className="w-4 h-4 mr-2" />
            Edit
          </Button>
        }
      />
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
              const date = parseDate(currentDate);
              const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
              setNewDateTime(localDate.toISOString().slice(0, 16));
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

                  if (status === "labor_started") {
                    await onUpdate({ laborStarted: dateString });
                  } else if (status === "gone_to_hospital") {
                    await onUpdate({ wentToHospital: dateString });
                  } else if (status === "born") {
                    await onUpdate({ babyBorn: dateString });
                  }

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
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            Edit
          </Button>
        }
      />
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
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            Change
          </Button>
        }
      />
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

type StatusUpdateButtonProps = {
  baby: BabyData;
  status: "labor_started" | "gone_to_hospital" | "born";
  currentStatus: Maybe<string>;
  label: string;
  icon: React.ReactNode;
  isNextState: boolean;
  onUpdate: BabyUpdateHandler;
};

export function StatusUpdateButton({
  baby: _baby,
  status,
  currentStatus,
  label,
  icon,
  isNextState,
  onUpdate,
}: StatusUpdateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const isCompleted = !!currentStatus;

  return (
    <Button
      onClick={async () => {
        setIsLoading(true);
        try {
          if (isCompleted) {
            if (status === "labor_started") {
              await onUpdate({ laborStarted: null });
            } else if (status === "gone_to_hospital") {
              await onUpdate({ wentToHospital: null });
            } else if (status === "born") {
              await onUpdate({ babyBorn: null });
            }
          } else {
            const now = new Date();
            const dateString = now.toISOString();

            if (status === "labor_started") {
              await onUpdate({ laborStarted: dateString });
            } else if (status === "gone_to_hospital") {
              await onUpdate({ wentToHospital: dateString });
            } else if (status === "born") {
              await onUpdate({ babyBorn: dateString });
            }
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to update status date");
        } finally {
          setIsLoading(false);
        }
      }}
      disabled={isLoading}
      variant={isNextState && !isCompleted ? "default" : "outline"}
    >
      {icon}
      {isCompleted ? `Unmark ${label}` : `Mark as ${label}`}
    </Button>
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
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            {photoUrl ? "Change" : "Add"}
          </Button>
        }
      />
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

// Re-export icons for convenience
export { Activity, Baby, Calendar, Camera, CheckCircle, Hospital };
