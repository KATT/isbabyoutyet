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
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import type { Doc } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Baby,
  Calendar,
  CheckCircle,
  Hospital,
  Palette,
  Settings,
  Share2,
} from "lucide-react";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import violetBloomCss from "@/styles/themes/violet-bloom.css?url";
import twitterCss from "@/styles/themes/twitter.css?url";
import bubblegumCss from "@/styles/themes/bubblegum.css?url";
import catppuccinCss from "@/styles/themes/catppuccin.css?url";
import mochaMousseCss from "@/styles/themes/mocha-mousse.css?url";
import quantumRoseCss from "@/styles/themes/quantum-rose.css?url";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  {
    value: null,
    label: "Default",
    colors: ["#ea580c", "#fef3c7", "#fed7aa"],
  }, // orange primary
  {
    value: "violet-bloom",
    label: "Violet Bloom",
    css: violetBloomCss,
    colors: ["#7033ff", "#fdfdfd", "#e2ebff"],
  },
  {
    value: "twitter",
    label: "Twitter Blue",
    css: twitterCss,
    colors: ["#1e9df1", "#ffffff", "#e3ecf6"],
  },
  {
    value: "bubblegum",
    label: "Bubblegum",
    css: bubblegumCss,
    colors: ["#d04f99", "#f6e6ee", "#fbe2a7"],
  },
  {
    value: "catppuccin",
    label: "Catppuccin",
    css: catppuccinCss,
    colors: ["#8839ef", "#eff1f5", "#04a5e5"],
  },
  {
    value: "mocha-mousse",
    label: "Mocha Mousse",
    css: mochaMousseCss,
    colors: ["#a37764", "#f1f0e5", "#e4c7b8"],
  },
  {
    value: "quantum-rose",
    label: "Quantum Rose",
    css: quantumRoseCss,
    colors: ["#e6067a", "#fff0f8", "#ffc1e3"],
  },
] as const;

function getThemeCssUrl(theme: string | null | undefined): string | null {
  if (!theme) return null;
  const option = THEME_OPTIONS.find((t) => t.value === theme);
  return option && "css" in option ? option.css : null;
}

function getThemePrimaryColor(theme: string | null | undefined): string {
  const defaultColor = "#ea580c"; // Default orange primary
  if (!theme) return defaultColor;
  const option = THEME_OPTIONS.find((t) => t.value === theme);
  return option?.colors[0] ?? defaultColor;
}

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
  baby: Doc<"baby">;
  currentDueDate: string;
  compact?: boolean;
};

function DueDateEditor({ baby, currentDueDate, compact = false }: DueDateEditorProps) {
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
                      babyId: baby._id,
                      dueDate: dateString,
                    });
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
                      babyId: baby._id,
                      dueDate: dateString,
                    });
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
  baby: Doc<"baby">;
  status: "labor_started" | "gone_to_hospital" | "born";
  currentDate: string;
  label: string;
  compact?: boolean;
};

function StatusDateEditor({
  baby,
  status,
  currentDate,
  label: _label,
  compact = false,
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

                    if (status === "labor_started") {
                      await updateBaby({
                        babyId: baby._id,
                        laborStarted: dateString,
                      });
                    } else if (status === "gone_to_hospital") {
                      await updateBaby({
                        babyId: baby._id,
                        wentToHospital: dateString,
                      });
                    } else if (status === "born") {
                      await updateBaby({
                        babyId: baby._id,
                        babyBorn: dateString,
                      });
                    }

                    setIsEditing(false);
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Failed to update status date",
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

                      if (status === "labor_started") {
                        await updateBaby({
                          babyId: baby._id,
                          laborStarted: dateString,
                        });
                      } else if (status === "gone_to_hospital") {
                        await updateBaby({
                          babyId: baby._id,
                          wentToHospital: dateString,
                        });
                      } else if (status === "born") {
                        await updateBaby({
                          babyId: baby._id,
                          babyBorn: dateString,
                        });
                      }

                      setIsEditing(false);
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Failed to update status date",
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
  baby: Doc<"baby">;
  currentName: string;
  compact?: boolean;
};

function NameEditor({ baby, currentName, compact = false }: NameEditorProps) {
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
                    babyId: baby._id,
                    name: newName.trim(),
                  });
                  setIsEditing(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to update name");
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
                      babyId: baby._id,
                      name: newName.trim(),
                    });
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
                      babyId: baby._id,
                      name: newName.trim(),
                    });
                    setIsEditing(false);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to update name");
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
                      babyId: baby._id,
                      name: newName.trim(),
                    });
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
  baby: Doc<"baby">;
  currentMessage: string | null | undefined;
  compact?: boolean;
};

function CustomMessageEditor({ baby, currentMessage, compact = false }: CustomMessageEditorProps) {
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
                      babyId: baby._id,
                      customMessage: newMessage.trim() || null,
                    });
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
                        babyId: baby._id,
                        customMessage: newMessage.trim() || null,
                      });
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

type BabyBornMessageEditorProps = {
  baby: Doc<"baby">;
  currentMessage: string | null | undefined;
  compact?: boolean;
};

function BabyBornMessageEditor({
  baby,
  currentMessage,
  compact = false,
}: BabyBornMessageEditorProps) {
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
            placeholder="Custom message to show when baby is born"
            className="mb-3 min-h-20"
          />
          <div className="flex gap-2 justify-end">
            <Button
              onClick={(e) => {
                e.stopPropagation();
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
              onClick={async (e) => {
                e.stopPropagation();
                if (hasChanges) {
                  setIsLoading(true);
                  try {
                    await updateBaby({
                      babyId: baby._id,
                      babyBornMessage: newMessage.trim() || null,
                    });
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

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        {isEditing ? (
          <>
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Custom message to show when baby is born"
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
                        babyId: baby._id,
                        babyBornMessage: newMessage.trim() || null,
                      });
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

type ThemeSelectorProps = {
  baby: Doc<"baby">;
};

function ThemeSelector({ baby }: ThemeSelectorProps) {
  const updateBaby = useMutation(api.baby.update);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleThemeChange = async (theme: string | null) => {
    setIsLoading(true);
    try {
      await updateBaby({
        babyId: baby._id,
        theme,
      });
      setIsOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update theme");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
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
              onClick={() => handleThemeChange(option.value)}
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
  baby: Doc<"baby">;
  status: "labor_started" | "gone_to_hospital" | "born";
  currentStatus: string | null;
  label: string;
  icon: React.ReactNode;
  isNextState: boolean;
  compact?: boolean;
  previousStatuses?: Array<{ label: string; isSet: boolean }>;
  subsequentStatuses?: Array<{ label: string }>;
};

function StatusUpdateButton({
  baby,
  status,
  currentStatus,
  label,
  icon,
  isNextState,
  compact = false,
  previousStatuses: _previousStatuses = [],
  subsequentStatuses: _subsequentStatuses = [],
}: StatusUpdateButtonProps) {
  const updateBaby = useMutation(api.baby.update);
  const [isLoading, setIsLoading] = useState(false);

  const isCompleted = !!currentStatus;

  const handleClick = async () => {
    setIsLoading(true);
    try {
      if (isCompleted) {
        if (status === "labor_started") {
          await updateBaby({
            babyId: baby._id,
            laborStarted: null,
          });
        } else if (status === "gone_to_hospital") {
          await updateBaby({
            babyId: baby._id,
            wentToHospital: null,
          });
        } else if (status === "born") {
          await updateBaby({
            babyId: baby._id,
            babyBorn: null,
          });
        }
      } else {
        const now = new Date();
        const dateString = now.toISOString();

        if (status === "labor_started") {
          await updateBaby({
            babyId: baby._id,
            laborStarted: dateString,
          });
        } else if (status === "gone_to_hospital") {
          await updateBaby({
            babyId: baby._id,
            wentToHospital: dateString,
          });
        } else if (status === "born") {
          await updateBaby({
            babyId: baby._id,
            babyBorn: dateString,
          });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status date");
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
  validateSearch: z.object({
    settings: z.boolean().optional(),
  }),
  loader: async (opts) => {
    const baby = await opts.context.convexClient.query(api.baby.getByPublicId, {
      publicId: opts.params.publicId,
    });
    if (!baby) {
      throw notFound();
    }
    return {
      baby,
    };
  },
  head: (opts) => {
    const baby = opts.loaderData?.baby;
    if (!baby) {
      return {
        meta: [
          {
            title: "Is Baby Out Yet? - Track Your Baby's Journey",
          },
          {
            name: "description",
            content: "Track the progress of labor and birth - know when baby arrives!",
          },
          {
            name: "theme-color",
            content: "#ea580c",
          },
        ],
      };
    }

    const overdueDays = getOverdueDays(baby.dueDate);
    const daysUntilDueDate = getDaysUntilDueDate(baby.dueDate);
    const isBorn = !!baby.babyBorn;

    let title = `Is ${baby.name} out yet?`;
    if (!isBorn) {
      if (overdueDays > 0) {
        title = `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue - Is ${baby.name} out yet?`;
      } else {
        title = `${daysUntilDueDate} ${daysUntilDueDate === 1 ? "day" : "days"} until due date - Is ${baby.name} out yet?`;
      }
    }
    title = `${title} - Track Your Baby's Journey`;

    const description = `Track ${baby.name}'s journey - know when baby arrives!`;

    const themeColor = getThemePrimaryColor(baby.theme);

    return {
      meta: [
        {
          title,
        },
        {
          name: "description",
          content: description,
        },
        {
          name: "theme-color",
          content: themeColor,
        },
      ],
    };
  },
});

function NavContent(props: { baby: Doc<"baby">; isOwner: boolean }) {
  const params = Route.useParams();
  const search = Route.useSearch();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;

    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <>
      <Button
        onClick={async () => {
          const url = `${window.location.origin}/baby/${props.baby.publicId}`;
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);

            toast.success("Copied to clipboard");
          } catch {
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

              toast.success("Copied to clipboard");
            } catch (cause) {
              // Handle error
              toast.error(
                "Failed to copy to clipboard: " +
                  (cause instanceof Error ? cause.message : "Unknown error"),
              );
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
      <ModeToggle />
      {props.isOwner && (
        <Button
          asChild
          variant={search.settings ? "default" : "outline"}
          size="icon"
          className="rounded-full"
        >
          <Link
            to="/baby/$publicId"
            params={{ publicId: params.publicId }}
            search={search.settings ? {} : { settings: true }}
          >
            <Settings className="w-4 h-4" />
          </Link>
        </Button>
      )}
    </>
  );
}

function BabyPage() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const loaderData = Route.useLoaderData();
  // Use prefetched data if available, otherwise use reactive query
  const queryBaby = useQuery(api.baby.getByPublicId, { publicId: params.publicId });
  // Prefer query result (reactive) over prefetched data, but use prefetched as fallback
  const baby = queryBaby ?? loaderData.baby;
  const themeCssUrl = getThemeCssUrl(baby.theme);
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

  const currentStatus = (() => {
    if (baby.babyBorn) {
      return { type: "born" as const, date: baby.babyBorn };
    }
    if (baby.wentToHospital) {
      return { type: "gone_to_hospital" as const, date: baby.wentToHospital };
    }
    if (baby.laborStarted) {
      return { type: "labor_started" as const, date: baby.laborStarted };
    }
    return null;
  })();

  // For progress bar: if a later status is set, show previous statuses as completed
  // Status updates remain independent, but progress bar assumes logical progression
  const isLaborCompletedForProgress =
    !!baby.laborStarted || !!baby.wentToHospital || !!baby.babyBorn;
  const isGoneToHospitalCompletedForProgress = !!baby.wentToHospital || !!baby.babyBorn;
  const isBornCompletedForProgress = !!baby.babyBorn;

  // Determine the next state (first uncompleted state)
  const isLaborNextState = !baby.laborStarted;
  const isGoneToHospitalNextState = !!baby.laborStarted && !baby.wentToHospital;
  const isBornNextState = !!baby.wentToHospital && !baby.babyBorn;

  const overdueDays = getOverdueDays(baby.dueDate);
  const daysUntilDueDate = getDaysUntilDueDate(baby.dueDate);

  // Sync ownerControlsOpen with query string

  const ownerControlsRef = useRef<HTMLDivElement>(null);
  return (
    <div>
      {themeCssUrl && <link rel="stylesheet" href={themeCssUrl} />}
      <AnimatePresence>
        {search.settings && isOwner && (
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
                  <NameEditor baby={baby} currentName={baby.name} compact />
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
                  <DueDateEditor baby={baby} currentDueDate={baby.dueDate} compact />
                </ItemActions>
              </Item>

              <ItemSeparator />

              {/* Status Updates */}
              {/* Labour started */}
              <Item>
                <ItemMedia variant="icon">
                  <Activity className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Labour started</ItemTitle>
                  {baby.laborStarted && (
                    <ItemDescription>
                      {formatDate(baby.laborStarted)} ({getRelativeTime(baby.laborStarted)})
                    </ItemDescription>
                  )}
                </ItemContent>
                <ItemActions>
                  {baby.laborStarted && (
                    <StatusDateEditor
                      baby={baby}
                      status="labor_started"
                      currentDate={baby.laborStarted}
                      label="Labour started"
                      compact
                    />
                  )}
                  <StatusUpdateButton
                    baby={baby}
                    status="labor_started"
                    currentStatus={baby.laborStarted || null}
                    label="Labour started"
                    icon={<Activity className="w-4 h-4" />}
                    isNextState={isLaborNextState}
                    compact
                    previousStatuses={[]}
                    subsequentStatuses={[{ label: "Gone to hospital" }, { label: "Baby born" }]}
                  />
                </ItemActions>
              </Item>

              <ItemSeparator />

              {/* Gone to hospital */}
              <Item>
                <ItemMedia variant="icon">
                  <Hospital className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Gone to hospital</ItemTitle>
                  {baby.wentToHospital && (
                    <ItemDescription>
                      {formatDate(baby.wentToHospital)} ({getRelativeTime(baby.wentToHospital)})
                    </ItemDescription>
                  )}
                </ItemContent>
                <ItemActions>
                  {baby.wentToHospital && (
                    <StatusDateEditor
                      baby={baby}
                      status="gone_to_hospital"
                      currentDate={baby.wentToHospital}
                      label="Gone to hospital"
                      compact
                    />
                  )}
                  <StatusUpdateButton
                    baby={baby}
                    status="gone_to_hospital"
                    currentStatus={baby.wentToHospital || null}
                    label="Gone to hospital"
                    icon={<Hospital className="w-4 h-4" />}
                    isNextState={isGoneToHospitalNextState}
                    compact
                    previousStatuses={[{ label: "Labour started", isSet: !!baby.laborStarted }]}
                    subsequentStatuses={[{ label: "Baby born" }]}
                  />
                </ItemActions>
              </Item>

              <ItemSeparator />
              <Item>
                <ItemMedia variant="icon">
                  <Hospital className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Hospital Message</ItemTitle>
                  <ItemDescription>{baby.customMessage || "Default message"}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <CustomMessageEditor baby={baby} currentMessage={baby.customMessage} compact />
                </ItemActions>
              </Item>

              <ItemSeparator />

              {/* Baby born */}
              <Item>
                <ItemMedia variant="icon">
                  <CheckCircle className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Baby born</ItemTitle>
                  {baby.babyBorn && (
                    <ItemDescription>
                      {formatDate(baby.babyBorn)} ({getRelativeTime(baby.babyBorn)})
                    </ItemDescription>
                  )}
                </ItemContent>
                <ItemActions>
                  {baby.babyBorn && (
                    <StatusDateEditor
                      baby={baby}
                      status="born"
                      currentDate={baby.babyBorn}
                      label="Baby born"
                      compact
                    />
                  )}
                  <StatusUpdateButton
                    baby={baby}
                    status="born"
                    currentStatus={baby.babyBorn || null}
                    label="Baby born"
                    icon={<CheckCircle className="w-4 h-4" />}
                    isNextState={isBornNextState}
                    compact
                    previousStatuses={[
                      { label: "Labour started", isSet: !!baby.laborStarted },
                      { label: "Gone to hospital", isSet: !!baby.wentToHospital },
                    ]}
                    subsequentStatuses={[]}
                  />
                </ItemActions>
              </Item>

              {/* Baby Born Message */}
              <Item>
                <ItemMedia variant="icon">
                  <CheckCircle className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Baby Born Message</ItemTitle>
                  <ItemDescription>{baby.babyBornMessage || "Default message"}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <BabyBornMessageEditor
                    baby={baby}
                    currentMessage={baby.babyBornMessage}
                    compact
                  />
                </ItemActions>
              </Item>

              <ItemSeparator />

              {/* Theme */}
              <Item>
                <ItemMedia variant="icon">
                  <Palette className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Theme</ItemTitle>
                  <ItemDescription>
                    {THEME_OPTIONS.find((t) => t.value === baby.theme)?.label || "Default"}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ThemeSelector baby={baby} />
                </ItemActions>
              </Item>
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

        <div className="border-b border-border/50">
          {/* Nav content desktop */}
          <div
            className={cn(
              // general
              "gap-2 p-4 z-10 flex",
              // mobile
              "fixed bottom-0 left-0",
              // desktop
              "md:absolute md:top-0 md:left-0",
            )}
          >
            <NavContent baby={baby} isOwner={isOwner} />
          </div>
          <h1 className="text-4xl md:text-7xl font-black text-foreground tracking-tight whitespace-nowrap py-6 md:py-10 px-6 text-center">
            <span className="bg-linear-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
              Is {baby.name} out yet?
            </span>
          </h1>
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
                      <p className="text-xl text-muted-foreground mb-4">
                        Born on {formatDate(currentStatus.date)} (
                        {getRelativeTime(currentStatus.date)})
                      </p>
                    )}
                    {baby.babyBornMessage && (
                      <div className="mt-6 p-6 bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/30 rounded-xl w-full max-w-md shadow-lg shadow-primary/10">
                        <p className="text-lg font-bold text-primary">{baby.babyBornMessage}</p>
                      </div>
                    )}
                  </div>
                )}
                <Separator />
              </CardContent>
              <CardFooter>
                {/* Progress indicator */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-4">
                    {/* Labour started */}
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
                          isLaborCompletedForProgress
                            ? "bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                            : currentStatus?.type === "labor_started"
                              ? "bg-linear-to-br from-primary/30 to-primary/20 text-primary border-2 border-primary/30 shadow-md"
                              : "bg-muted/50 text-muted-foreground border border-border"
                        }`}
                      >
                        <Activity className="w-10 h-10 md:w-12 md:h-12" />
                      </div>
                      <p
                        className={`text-sm md:text-base font-semibold mb-1 ${
                          isLaborCompletedForProgress
                            ? "text-foreground"
                            : currentStatus?.type === "labor_started"
                              ? "text-primary"
                              : "text-muted-foreground"
                        }`}
                      >
                        Labour started
                      </p>
                      {baby.laborStarted && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {getRelativeTime(baby.laborStarted)}
                        </p>
                      )}
                    </div>

                    {/* Gone to hospital */}
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
                          isGoneToHospitalCompletedForProgress
                            ? "bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                            : currentStatus?.type === "gone_to_hospital"
                              ? "bg-linear-to-br from-primary/30 to-primary/20 text-primary border-2 border-primary/30 shadow-md"
                              : "bg-muted/50 text-muted-foreground border border-border"
                        }`}
                      >
                        <Hospital className="w-10 h-10 md:w-12 md:h-12" />
                      </div>
                      <p
                        className={`text-sm md:text-base font-semibold mb-1 ${
                          isGoneToHospitalCompletedForProgress
                            ? "text-foreground"
                            : currentStatus?.type === "gone_to_hospital"
                              ? "text-primary"
                              : "text-muted-foreground"
                        }`}
                      >
                        Gone to hospital
                      </p>
                      {baby.wentToHospital && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {getRelativeTime(baby.wentToHospital)}
                        </p>
                      )}
                    </div>

                    {/* Baby born */}
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
                          isBornCompletedForProgress
                            ? "bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                            : currentStatus?.type === "born"
                              ? "bg-linear-to-br from-primary/30 to-primary/20 text-primary border-2 border-primary/30 shadow-md"
                              : "bg-muted/50 text-muted-foreground border border-border"
                        }`}
                      >
                        <CheckCircle className="w-10 h-10 md:w-12 md:h-12" />
                      </div>
                      <p
                        className={`text-sm md:text-base font-semibold mb-1 ${
                          isBornCompletedForProgress
                            ? "text-foreground"
                            : currentStatus?.type === "born"
                              ? "text-primary"
                              : "text-muted-foreground"
                        }`}
                      >
                        Baby born
                      </p>
                      {baby.babyBorn && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {getRelativeTime(baby.babyBorn)}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <Progress
                    value={
                      ((() => {
                        switch (currentStatus?.type) {
                          case "labor_started":
                            return 1;
                          case "gone_to_hospital":
                            return 2;
                          case "born":
                            return 3;
                          default:
                            return 0;
                        }
                      })() /
                        3) *
                      100
                    }
                  />
                </div>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8 border-t border-border/50">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Having a baby? Annoyed with people pestering you? Create your own page →
          </Link>
        </div>
      </div>
    </div>
  );
}
