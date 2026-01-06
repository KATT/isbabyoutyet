import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";
import { Activity, Baby, Calendar, CheckCircle, Clock, Hospital } from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import type { BabyData, BabyUpdateHandler, Maybe } from "./types";
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

type CustomMessageEditorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

export function CustomMessageEditor({ baby, onUpdate }: CustomMessageEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newMessage, setNewMessage] = useState(baby.customMessage || "");
  const [isLoading, setIsLoading] = useState(false);

  const hasChanges = newMessage !== (baby.customMessage || "");

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <Textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Do not disturb, only send messages to the parents"
          className="mb-3 min-h-20"
        />
        <div className="flex gap-2 justify-end">
          <Button
            onClick={() => {
              setNewMessage(baby.customMessage || "");
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
                  await onUpdate({ customMessage: newMessage.trim() || null });
                  setIsEditing(false);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Failed to update hospital message",
                  );
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

type BabyBornMessageEditorProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
};

export function BabyBornMessageEditor({ baby, onUpdate }: BabyBornMessageEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newMessage, setNewMessage] = useState(baby.babyBornMessage || "");
  const [isLoading, setIsLoading] = useState(false);

  const hasChanges = newMessage !== (baby.babyBornMessage || "");

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <Textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Custom message to show when baby is born"
          className="mb-3 min-h-20"
        />
        <div className="flex gap-2 justify-end">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setNewMessage(baby.babyBornMessage || "");
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
                  await onUpdate({ babyBornMessage: newMessage.trim() || null });
                  setIsEditing(false);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Failed to update baby born message",
                  );
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

// Re-export icons for convenience
export { Activity, Baby, Calendar, CheckCircle, Hospital };
