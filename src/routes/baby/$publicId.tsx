import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { Doc } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Baby, Calendar, CheckCircle, Hospital, Settings, Share2 } from "lucide-react";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";

const TIMEZONE = "Europe/Stockholm";

function parseDate(dateString: string): Date {
  return parseISO(dateString);
}

function formatDate(dateString: string): string {
  const date = parseDate(dateString);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    dateStyle: "long",
    timeStyle: "short",
  });
  return formatter.format(date);
}

function getRelativeTime(dateString: string): string {
  const date = parseDate(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);

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

function getDaysUntilDueDate(dueDate: string): number {
  const now = new Date();
  const due = parseDate(dueDate);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const nowParts = formatter.formatToParts(now);
  const currentYearPart = nowParts.find((p) => p.type === "year");
  const currentMonthPart = nowParts.find((p) => p.type === "month");
  const currentDayPart = nowParts.find((p) => p.type === "day");
  if (!currentYearPart || !currentMonthPart || !currentDayPart) {
    return 0;
  }
  const currentYear = parseInt(currentYearPart.value);
  const currentMonth = parseInt(currentMonthPart.value);
  const currentDay = parseInt(currentDayPart.value);

  const dueParts = formatter.formatToParts(due);
  const dueYearPart = dueParts.find((p) => p.type === "year");
  const dueMonthPart = dueParts.find((p) => p.type === "month");
  const dueDayPart = dueParts.find((p) => p.type === "day");
  if (!dueYearPart || !dueMonthPart || !dueDayPart) {
    return 0;
  }
  const dueYear = parseInt(dueYearPart.value);
  const dueMonth = parseInt(dueMonthPart.value);
  const dueDay = parseInt(dueDayPart.value);

  const currentDate = new Date(currentYear, currentMonth - 1, currentDay);
  const dueDateObj = new Date(dueYear, dueMonth - 1, dueDay);

  const diffInMs = dueDateObj.getTime() - currentDate.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  return diffInDays;
}

function getOverdueDays(dueDate: string): number {
  const daysUntil = getDaysUntilDueDate(dueDate);
  return Math.max(0, -daysUntil);
}

type DueDateEditorProps = {
  babyId: string;
  currentDueDate: string;
  compact?: boolean;
};

function DueDateEditor({ babyId, currentDueDate, compact = false }: DueDateEditorProps) {
  const updateBaby = useMutation(api.baby.update);
  const [isEditing, setIsEditing] = useState(false);
  const [newDate, setNewDate] = useState(() => {
    const date = parseDate(currentDueDate);
    return format(date, "yyyy-MM-dd");
  });
  const [isLoading, setIsLoading] = useState(false);

  const currentDateFormatted = format(parseDate(currentDueDate), "yyyy-MM-dd");
  const hasChanges = newDate !== currentDateFormatted;

  if (compact) {
    return (
      <Popover open={isEditing} onOpenChange={setIsEditing}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-80"
          onInteractOutside={(e) => {
            // Prevent closing when the date input is focused (native picker might be open)
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
            onMouseDown={(e) => {
              // Prevent popover from closing when clicking on date input
              e.stopPropagation();
            }}
            onFocus={(e) => {
              // Prevent popover from closing when date picker opens
              e.stopPropagation();
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                const date = parseDate(currentDueDate);
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
                    await updateBaby({
                      babyId: babyId as any,
                      dueDate: dateString,
                    });
                    setIsEditing(false);
                  } catch (err) {
                    if (err instanceof Error) {
                      // Handle error appropriately
                    }
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

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground mb-4">Due Date</h3>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          {isEditing ? (
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full"
            />
          ) : (
            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">
                {format(parseDate(currentDueDate), "MMMM d, yyyy")}
              </span>
            </div>
          )}
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline">
            Change
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const date = parseDate(currentDueDate);
                setNewDate(format(date, "yyyy-MM-dd"));
                setIsEditing(false);
              }}
              variant="outline"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (hasChanges) {
                  setIsLoading(true);
                  try {
                    const dateObj = parseISO(newDate);
                    const dateString = dateObj.toISOString();
                    await updateBaby({
                      babyId: babyId as any,
                      dueDate: dateString,
                    });
                    setIsEditing(false);
                  } catch (err) {
                    if (err instanceof Error) {
                      // Handle error appropriately
                    }
                  } finally {
                    setIsLoading(false);
                  }
                } else {
                  setIsEditing(false);
                }
              }}
              disabled={isLoading || !hasChanges}
            >
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

type StatusDateEditorProps = {
  babyId: string;
  status: "labor_started" | "gone_to_hospital" | "born";
  currentDate: string;
  label: string;
  compact?: boolean;
  baby: Doc<"baby">;
};

function StatusDateEditor({
  babyId,
  status,
  currentDate,
  label: _label,
  compact = false,
  baby,
}: StatusDateEditorProps) {
  const updateBaby = useMutation(api.baby.update);
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

  if (compact) {
    return (
      <Popover open={isEditing} onOpenChange={setIsEditing}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-80"
          onInteractOutside={(e) => {
            // Prevent closing when the date input is focused (native picker might be open)
            const activeElement = document.activeElement;
            if (
              activeElement?.tagName === "INPUT" &&
              (activeElement as HTMLInputElement).type === "datetime-local"
            ) {
              e.preventDefault();
            }
          }}
        >
          <Input
            type="datetime-local"
            value={newDateTime}
            onChange={(e) => setNewDateTime(e.target.value)}
            className="mb-3"
            onMouseDown={(e) => {
              // Prevent popover from closing when clicking on date input
              e.stopPropagation();
            }}
            onFocus={(e) => {
              // Prevent popover from closing when date picker opens
              e.stopPropagation();
            }}
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
                    const updateFields: {
                      laborStarted?: string | null;
                      wentToHospital?: string | null;
                      babyBorn?: string | null;
                    } = {};

                    if (status === "labor_started") {
                      updateFields.laborStarted = dateString;
                    } else if (status === "gone_to_hospital") {
                      updateFields.wentToHospital = dateString;
                    } else if (status === "born") {
                      updateFields.babyBorn = dateString;
                      if (!baby.wentToHospital) {
                        updateFields.wentToHospital = dateString;
                      }
                    }

                    await updateBaby({
                      babyId: babyId as any,
                      ...updateFields,
                    });
                    setIsEditing(false);
                  } catch (err) {
                    if (err instanceof Error) {
                      // Handle error appropriately
                    }
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

  return (
    <div className="pl-6 border-l-2 border-muted">
      <div className="flex items-center gap-2 text-sm">
        {isEditing ? (
          <>
            <Input
              type="datetime-local"
              value={newDateTime}
              onChange={(e) => setNewDateTime(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
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
                onClick={async () => {
                  if (hasChanges) {
                    setIsLoading(true);
                    try {
                      const dateObj = parseISO(newDateTime);
                      const dateString = dateObj.toISOString();
                      const updateFields: {
                        laborStarted?: string | null;
                        wentToHospital?: string | null;
                        babyBorn?: string | null;
                      } = {};

                      if (status === "labor_started") {
                        updateFields.laborStarted = dateString;
                      } else if (status === "gone_to_hospital") {
                        updateFields.wentToHospital = dateString;
                      } else if (status === "born") {
                        updateFields.babyBorn = dateString;
                        if (!baby.wentToHospital) {
                          updateFields.wentToHospital = dateString;
                        }
                      }

                      await updateBaby({
                        babyId: babyId as any,
                        ...updateFields,
                      });
                      setIsEditing(false);
                    } catch (err) {
                      if (err instanceof Error) {
                        // Handle error appropriately
                      }
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
          </>
        ) : (
          <>
            <span className="text-muted-foreground">
              {formatDate(currentDate)} ({getRelativeTime(currentDate)})
            </span>
            <Button onClick={() => setIsEditing(true)} variant="ghost" size="sm">
              Change
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

type NameEditorProps = {
  babyId: string;
  currentName: string;
  compact?: boolean;
};

function NameEditor({ babyId, currentName, compact = false }: NameEditorProps) {
  const updateBaby = useMutation(api.baby.update);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);

  const hasChanges = newName.trim() !== currentName.trim();

  if (compact) {
    return (
      <Popover open={isEditing} onOpenChange={setIsEditing}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
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
                  await updateBaby({
                    babyId: babyId as any,
                    name: newName.trim(),
                  });
                  setIsEditing(false);
                } catch (err) {
                  if (err instanceof Error) {
                    // Handle error appropriately
                  }
                } finally {
                  setIsLoading(false);
                }
              } else if (e.key === "Escape") {
                setNewName(currentName);
                setIsEditing(false);
              }
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => {
                setNewName(currentName);
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
                    await updateBaby({
                      babyId: babyId as any,
                      name: newName.trim(),
                    });
                    setIsEditing(false);
                  } catch (err) {
                    if (err instanceof Error) {
                      // Handle error appropriately
                    }
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

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground mb-4">Baby Name</h3>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          {isEditing ? (
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Baby name"
              className="w-full"
              onKeyDown={async (e) => {
                if (e.key === "Enter" && hasChanges) {
                  e.preventDefault();
                  setIsLoading(true);
                  try {
                    await updateBaby({
                      babyId: babyId as any,
                      name: newName.trim(),
                    });
                    setIsEditing(false);
                  } catch (err) {
                    if (err instanceof Error) {
                      // Handle error appropriately
                    }
                  } finally {
                    setIsLoading(false);
                  }
                } else if (e.key === "Escape") {
                  setNewName(currentName);
                  setIsEditing(false);
                }
              }}
            />
          ) : (
            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
              <Baby className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{currentName}</span>
            </div>
          )}
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline">
            Change
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setNewName(currentName);
                setIsEditing(false);
              }}
              variant="outline"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (hasChanges) {
                  setIsLoading(true);
                  try {
                    await updateBaby({
                      babyId: babyId as any,
                      name: newName.trim(),
                    });
                    setIsEditing(false);
                  } catch (err) {
                    if (err instanceof Error) {
                      // Handle error appropriately
                    }
                  } finally {
                    setIsLoading(false);
                  }
                } else {
                  setIsEditing(false);
                }
              }}
              disabled={isLoading || !hasChanges}
            >
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

type CustomMessageEditorProps = {
  babyId: string;
  currentMessage: string | null | undefined;
  compact?: boolean;
};

function CustomMessageEditor({
  babyId,
  currentMessage,
  compact = false,
}: CustomMessageEditorProps) {
  const updateBaby = useMutation(api.baby.update);
  const [isEditing, setIsEditing] = useState(false);
  const [newMessage, setNewMessage] = useState(currentMessage || "");
  const [isLoading, setIsLoading] = useState(false);

  const hasChanges = newMessage !== (currentMessage || "");

  if (compact) {
    return (
      <Popover open={isEditing} onOpenChange={setIsEditing}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
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
                setNewMessage(currentMessage || "");
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
                    await updateBaby({
                      babyId: babyId as any,
                      customMessage: newMessage.trim() || null,
                    });
                    setIsEditing(false);
                  } catch (err) {
                    if (err instanceof Error) {
                      // Handle error appropriately
                    }
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

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        {isEditing ? (
          <>
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Do not disturb, only send messages to the parents"
              className="flex-1 min-h-20"
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setNewMessage(currentMessage || "");
                  setIsEditing(false);
                }}
                variant="outline"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (hasChanges) {
                    setIsLoading(true);
                    try {
                      await updateBaby({
                        babyId: babyId as any,
                        customMessage: newMessage.trim() || null,
                      });
                      setIsEditing(false);
                    } catch (err) {
                      if (err instanceof Error) {
                        // Handle error appropriately
                      }
                    } finally {
                      setIsLoading(false);
                    }
                  } else {
                    setIsEditing(false);
                  }
                }}
                disabled={isLoading || !hasChanges}
              >
                Save
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 text-sm text-muted-foreground">
              {currentMessage ? "Custom message set" : "Default message"}
            </div>
            <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
              Edit
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

type StatusUpdateButtonProps = {
  babyId: string;
  status: "labor_started" | "gone_to_hospital" | "born";
  currentStatus: string | null;
  label: string;
  icon: React.ReactNode;
  isNextState: boolean;
  compact?: boolean;
  previousStatuses?: Array<{ label: string; isSet: boolean }>;
  subsequentStatuses?: Array<{ label: string }>;
  baby: Doc<"baby">;
};

function StatusUpdateButton({
  babyId,
  status,
  currentStatus,
  label,
  icon,
  isNextState,
  compact = false,
  previousStatuses: _previousStatuses = [],
  subsequentStatuses: _subsequentStatuses = [],
  baby,
}: StatusUpdateButtonProps) {
  const updateBaby = useMutation(api.baby.update);
  const [isLoading, setIsLoading] = useState(false);

  const isCompleted = !!currentStatus;

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const updateFields: {
        laborStarted?: string | null;
        wentToHospital?: string | null;
        babyBorn?: string | null;
      } = {};

      if (isCompleted) {
        if (status === "labor_started") {
          updateFields.laborStarted = null;
          updateFields.wentToHospital = null;
          updateFields.babyBorn = null;
        } else if (status === "gone_to_hospital") {
          updateFields.wentToHospital = null;
          updateFields.babyBorn = null;
        } else {
          updateFields.babyBorn = null;
        }
      } else {
        const now = new Date();
        const dateString = now.toISOString();

        if (status === "labor_started") {
          updateFields.laborStarted = dateString;
        } else if (status === "gone_to_hospital") {
          updateFields.wentToHospital = dateString;
        } else if (status === "born") {
          updateFields.babyBorn = dateString;
          if (!baby.wentToHospital) {
            updateFields.wentToHospital = dateString;
          }
        }
      }

      await updateBaby({
        babyId: babyId as any,
        ...updateFields,
      });
    } catch (err) {
      if (err instanceof Error) {
        // Handle error appropriately
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      variant={isNextState && !isCompleted ? "default" : isCompleted ? "default" : "outline"}
      size={compact ? "sm" : "default"}
      className={compact ? "" : "w-full"}
    >
      {icon}
      {compact
        ? isCompleted
          ? "Unmark"
          : "Mark"
        : isCompleted
          ? `Unmark ${label}`
          : `Mark as ${label}`}
    </Button>
  );
}

export const Route = createFileRoute("/baby/$publicId")({
  component: BabyPage,
  loader: async (opts) => {
    const baby = await opts.context.convexClient.query(api.baby.getByPublicId, {
      publicId: opts.params.publicId,
    });
    if (!baby) {
      throw notFound();
    }
    return { baby: baby };
  },
  head: () => {
    // This will be updated dynamically based on the baby data
    return {
      meta: [
        {
          title: "Is Baby out yet?",
        },
      ],
    };
  },
});

function BabyPage() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const loaderData = Route.useLoaderData();
  // Use prefetched data if available, otherwise use reactive query
  const queryBaby = useQuery(api.baby.getByPublicId, { publicId: params.publicId });
  // Prefer query result (reactive) over prefetched data, but use prefetched as fallback
  const baby = queryBaby ?? loaderData.baby;
  const sessionResult = authClient.useSession();

  // Redirect if baby found but current publicId doesn't match (client-side check)
  useEffect(() => {
    if (baby && baby.publicId !== params.publicId) {
      navigate({
        to: "/baby/$publicId",
        params: { publicId: baby.publicId },
        replace: true,
      });
    }
  }, [baby, params.publicId, navigate]);

  // Better-auth user ID is in session.user.id, but Convex uses identity.subject which is the same
  const isOwner = sessionResult.data?.user?.id === baby.userId;

  // Determine current status - find the latest date
  const states = [
    { type: "labor_started" as const, date: baby.laborStarted || null },
    { type: "gone_to_hospital" as const, date: baby.wentToHospital || null },
    { type: "born" as const, date: baby.babyBorn || null },
  ];

  // Find the current status (the one with the latest date)
  let currentStatus: (typeof states)[number] | null = null;
  let latestDate: Date | null = null;
  for (const state of states) {
    if (state.date) {
      const date = parseDate(state.date);
      if (!latestDate || date > latestDate) {
        latestDate = date;
        currentStatus = state;
      }
    }
  }

  // For progress bar: if a later status is set, show previous statuses as completed
  // Status updates remain independent, but progress bar assumes logical progression
  const isStateCompletedForProgress = (state: (typeof states)[number]): boolean => {
    if (state.type === "labor_started") {
      // Labor is completed if it has a date OR if gone_to_hospital or born is set
      return !!state.date || !!baby.wentToHospital || !!baby.babyBorn;
    }
    if (state.type === "gone_to_hospital") {
      // Gone to hospital is completed if it has a date OR if born is set
      return !!state.date || !!baby.babyBorn;
    }
    // Born is only completed if it has a date
    return !!state.date;
  };

  // Progress is based on how many fields are set (not order)
  // For progress bar, count states as completed if they have dates OR if later statuses are set
  const completedCount = states.filter((s) => isStateCompletedForProgress(s)).length;

  // Determine the next state (first uncompleted state)
  // For UI logic, only consider explicitly set statuses
  const nextStateIndex = states.findIndex((s) => !s.date);
  const isNextState = (index: number) => index === nextStateIndex;

  const stateLabels = {
    labor_started: "Labour started",
    gone_to_hospital: "Gone to hospital",
    born: "Baby born",
  };

  const stateIcons = {
    labor_started: Activity,
    gone_to_hospital: Hospital,
    born: CheckCircle,
  };

  const overdueDays = getOverdueDays(baby.dueDate);
  const daysUntilDueDate = getDaysUntilDueDate(baby.dueDate);

  const [ownerControlsOpen, setOwnerControlsOpen] = useState(false);
  const ownerControlsRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <AnimatePresence>
        {ownerControlsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            ref={ownerControlsRef}
          >
            <ItemGroup className="">
              {/* Baby Name */}
              <Item>
                <ItemMedia variant="icon">
                  <Baby className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Baby Name</ItemTitle>
                  <ItemDescription>{baby.name}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <NameEditor babyId={baby._id} currentName={baby.name} compact />
                </ItemActions>
              </Item>

              <ItemSeparator />

              {/* Due Date */}
              <Item>
                <ItemMedia variant="icon">
                  <Calendar className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Due Date</ItemTitle>
                  <ItemDescription>
                    {format(parseDate(baby.dueDate), "MMMM d, yyyy")}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <DueDateEditor babyId={baby._id} currentDueDate={baby.dueDate} compact />
                </ItemActions>
              </Item>

              <ItemSeparator />

              {/* Custom Message */}
              <Item>
                <ItemMedia variant="icon">
                  <Hospital className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Hospital Message</ItemTitle>
                  <ItemDescription>{baby.customMessage || "Default message"}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <CustomMessageEditor
                    babyId={baby._id}
                    currentMessage={baby.customMessage}
                    compact
                  />
                </ItemActions>
              </Item>

              <ItemSeparator />

              {/* Status Updates */}
              {states.map((state, index) => {
                const StatusIcon = stateIcons[state.type];
                const previousStatuses = states.slice(0, index).map((s) => ({
                  label: stateLabels[s.type],
                  isSet: !!s.date,
                }));
                const subsequentStatuses = states.slice(index + 1).map((s) => ({
                  label: stateLabels[s.type],
                }));
                return (
                  <React.Fragment key={state.type}>
                    <Item>
                      <ItemMedia variant="icon">
                        <StatusIcon className="w-4 h-4" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{stateLabels[state.type]}</ItemTitle>
                        {state.date && (
                          <ItemDescription>
                            {formatDate(state.date)} ({getRelativeTime(state.date)})
                          </ItemDescription>
                        )}
                      </ItemContent>
                      <ItemActions>
                        {state.date && (
                          <StatusDateEditor
                            babyId={baby._id}
                            status={state.type}
                            currentDate={state.date}
                            label={stateLabels[state.type]}
                            compact
                            baby={baby}
                          />
                        )}
                        <StatusUpdateButton
                          babyId={baby._id}
                          status={state.type}
                          currentStatus={state.date}
                          label={stateLabels[state.type]}
                          icon={<StatusIcon className="w-4 h-4" />}
                          isNextState={isNextState(index)}
                          compact
                          previousStatuses={previousStatuses}
                          subsequentStatuses={subsequentStatuses}
                          baby={baby}
                        />
                      </ItemActions>
                    </Item>
                    {index < states.length - 1 && <ItemSeparator />}
                  </React.Fragment>
                );
              })}
            </ItemGroup>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Gradient Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50">
          <div className="relative">
            <h1 className="text-4xl md:text-7xl font-black text-foreground tracking-tight whitespace-nowrap py-6 md:py-10 px-6 text-center">
              <span className="bg-linear-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
                Is {baby.name} out yet?
              </span>
            </h1>
            <div className="absolute top-4 left-6 flex gap-2">
              <Button
                onClick={async () => {
                  const url = `${window.location.origin}/baby/${baby.publicId}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast.success("Copied to clipboard");
                  } catch (err) {
                    // Fallback for older browsers
                    const textArea = document.createElement("textarea");
                    textArea.value = url;
                    textArea.style.position = "fixed";
                    textArea.style.opacity = "0";
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                      document.execCommand("copy");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                      toast.success("Copied to clipboard");
                    } catch (fallbackErr) {
                      // Handle error
                    }
                    document.body.removeChild(textArea);
                  }
                }}
                variant="outline"
                size="icon"
                className="rounded-full"
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              </Button>
              {isOwner && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                  }}
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.15, 1],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: 3,
                      repeatDelay: 0.5,
                      ease: "easeInOut",
                    }}
                  >
                    <Button
                      onClick={() => {
                        setOwnerControlsOpen(!ownerControlsOpen);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      variant={ownerControlsOpen ? "default" : "outline"}
                      size="icon"
                      className="rounded-full"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </motion.div>
                </motion.div>
              )}
            </div>
            <div className="absolute top-4 right-6">
              <ModeToggle />
            </div>
          </div>
        </div>
        <section className="relative px-6 py-12 text-center overflow-hidden">
          <div className="relative max-w-5xl mx-auto">
            <Card>
              <CardContent>
                {/* Current status display */}
                {!currentStatus && (
                  <div className="flex flex-col items-center py-8">
                    <div className="inline-flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-full bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/20 mb-8 shadow-lg shadow-primary/10">
                      <Baby className="w-16 h-16 md:w-20 md:h-20 text-primary" />
                    </div>
                    <h2 className="text-3xl md:text-6xl font-black text-foreground mb-4 whitespace-nowrap">
                      <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                        Not yet
                      </span>
                    </h2>
                    <p className="text-xl text-muted-foreground mb-6">Baby is still on the way</p>
                    <div
                      className={`mt-4 p-6 rounded-xl shadow-lg ${
                        overdueDays > 0
                          ? "bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/30 shadow-primary/10"
                          : "bg-muted/50 border border-border"
                      }`}
                    >
                      {overdueDays > 0 ? (
                        <>
                          <p className="text-xl font-bold text-primary">
                            {overdueDays} {overdueDays === 1 ? "day" : "days"} overdue
                          </p>
                          <p className="text-sm text-primary/80 mt-2">
                            Due date: {format(parseDate(baby.dueDate), "MMMM d, yyyy")}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-bold text-foreground">
                            {daysUntilDueDate} {daysUntilDueDate === 1 ? "day" : "days"} until due
                            date
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Due date: {format(parseDate(baby.dueDate), "MMMM d, yyyy")}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {currentStatus?.type === "labor_started" && (
                  <div className="flex flex-col items-center py-8">
                    <div className="inline-flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-full bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/20 mb-8 shadow-lg shadow-primary/10">
                      <Activity className="w-16 h-16 md:w-20 md:h-20 text-primary" />
                    </div>
                    <h2 className="text-3xl md:text-6xl font-black text-foreground mb-4 whitespace-nowrap">
                      <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                        Labour started
                      </span>
                    </h2>
                    <p className="text-xl text-muted-foreground mb-2">Not gone to hospital yet</p>
                    {currentStatus.date && (
                      <p className="text-lg text-muted-foreground mt-2">
                        Started at {formatDate(currentStatus.date)} (
                        {getRelativeTime(currentStatus.date)})
                      </p>
                    )}
                  </div>
                )}

                {currentStatus?.type === "gone_to_hospital" && (
                  <div className="flex flex-col items-center py-8">
                    <div className="inline-flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-full bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/20 mb-8 shadow-lg shadow-primary/10">
                      <Hospital className="w-16 h-16 md:w-20 md:h-20 text-primary" />
                    </div>
                    <h2 className="text-3xl md:text-6xl font-black text-foreground mb-4 whitespace-nowrap">
                      <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                        Gone to hospital
                      </span>
                    </h2>
                    {currentStatus.date && (
                      <p className="text-xl text-muted-foreground mb-4">
                        {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
                      </p>
                    )}
                    {baby.customMessage && (
                      <div className="mt-6 p-6 bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/30 rounded-xl w-full max-w-md shadow-lg shadow-primary/10">
                        <p className="text-lg font-bold text-primary">{baby.customMessage}</p>
                      </div>
                    )}
                  </div>
                )}

                {currentStatus?.type === "born" && (
                  <div className="flex flex-col items-center py-8">
                    <div className="inline-flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-full bg-linear-to-br from-primary to-primary/80 border-2 border-primary/30 mb-8 shadow-xl shadow-primary/20">
                      <CheckCircle className="w-16 h-16 md:w-20 md:h-20 text-primary-foreground" />
                    </div>
                    <h2 className="text-3xl md:text-6xl font-black text-foreground mb-4 whitespace-nowrap">
                      <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                        Yes! Baby is out
                      </span>
                    </h2>
                    {currentStatus.date && (
                      <p className="text-xl text-muted-foreground">
                        Born on {formatDate(currentStatus.date)} (
                        {getRelativeTime(currentStatus.date)})
                      </p>
                    )}
                  </div>
                )}
                <Separator />
              </CardContent>
              <CardFooter>
                {/* Progress indicator */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-4">
                    {states.map((state) => {
                      // For progress bar, show previous statuses as completed if later ones are set
                      const isCompleted = isStateCompletedForProgress(state);
                      const isCurrent = currentStatus?.type === state.type;
                      const Icon = stateIcons[state.type];

                      return (
                        <div key={state.type} className="flex flex-col items-center flex-1">
                          <div
                            className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
                              isCompleted
                                ? "bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                                : isCurrent
                                  ? "bg-linear-to-br from-primary/30 to-primary/20 text-primary border-2 border-primary/30 shadow-md"
                                  : "bg-muted/50 text-muted-foreground border border-border"
                            }`}
                          >
                            <Icon className="w-10 h-10 md:w-12 md:h-12" />
                          </div>
                          <p
                            className={`text-sm md:text-base font-semibold mb-1 ${
                              isCompleted
                                ? "text-foreground"
                                : isCurrent
                                  ? "text-primary"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {stateLabels[state.type]}
                          </p>
                          {state.date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {getRelativeTime(state.date)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Progress bar */}
                  <Progress value={(completedCount / states.length) * 100} />
                </div>
              </CardFooter>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
