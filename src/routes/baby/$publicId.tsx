import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { Baby, Hospital, CheckCircle, Activity, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ModeToggle } from "@/components/ui/mode-toggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Doc } from "convex/_generated/dataModel";

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

function getOverdueDays(dueDate: string): number {
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

  const diffInMs = currentDate.getTime() - dueDateObj.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffInDays);
}

type DueDateEditorProps = {
  babyId: string;
  currentDueDate: string;
  compact?: boolean;
};

function DueDateEditor({ babyId, currentDueDate, compact = false }: DueDateEditorProps) {
  const updateBaby = useMutation(api.babies.update);
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
  baby: Doc<"babies">;
};

function StatusDateEditor({
  babyId,
  status,
  currentDate,
  label: _label,
  compact = false,
  baby,
}: StatusDateEditorProps) {
  const updateBaby = useMutation(api.babies.update);
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
  const updateBaby = useMutation(api.babies.update);
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
  const updateBaby = useMutation(api.babies.update);
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
  baby: Doc<"babies">;
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
  const updateBaby = useMutation(api.babies.update);
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
  const queryResult = useSuspenseQuery(
    convexQuery(api.babies.getByPublicId, { publicId: params.publicId }),
  );
  const sessionResult = useSession();

  // Redirect if baby found but current publicId doesn't match (client-side check)
  useEffect(() => {
    if (queryResult.data && queryResult.data.publicId !== params.publicId) {
      navigate({
        to: "/baby/$publicId",
        params: { publicId: queryResult.data.publicId },
        replace: true,
      });
    }
  }, [queryResult.data, params.publicId, navigate]);

  if (queryResult.data === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Baby not found</div>
      </div>
    );
  }

  const baby = queryResult.data;
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

  const getStateClasses = (
    _stateType: (typeof states)[number]["type"],
    isCompleted: boolean,
    isCurrent: boolean,
  ) => {
    if (isCompleted) {
      return {
        circle: "bg-primary text-primary-foreground",
        text: "text-foreground",
      };
    }
    if (isCurrent) {
      return {
        circle: "bg-primary/50 border-2 border-primary text-primary",
        text: "text-primary",
      };
    }
    return {
      circle: "bg-muted text-muted-foreground",
      text: "text-muted-foreground",
    };
  };

  const overdueDays = getOverdueDays(baby.dueDate);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="relative">
          <h1 className="text-3xl md:text-6xl font-black text-foreground tracking-[-0.08em] whitespace-nowrap py-4 md:py-8 px-6 text-center">
            <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Is {baby.name} out yet?
            </span>
          </h1>
          <div className="absolute top-4 right-6">
            <ModeToggle />
          </div>
        </div>
      </div>
      <section className="relative px-6 text-center overflow-hidden">
        <div className="relative max-w-4xl mx-auto">
          <Card className="p-8 md:p-12 shadow-2xl">
            {/* Owner-only update controls */}
            {isOwner && (
              <div className="mb-8 text-left">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="updates">
                    <AccordionTrigger className="text-base font-semibold text-left">
                      Update Status & Settings
                    </AccordionTrigger>
                    <AccordionContent className="text-left">
                      <div className="space-y-1">
                        {/* Status Updates */}
                        {states.map((state, index) => {
                          const StatusIcon = stateIcons[state.type];
                          const isCompleted = !!state.date;
                          const previousStatuses = states.slice(0, index).map((s) => ({
                            label: stateLabels[s.type],
                            isSet: !!s.date,
                          }));
                          const subsequentStatuses = states.slice(index + 1).map((s) => ({
                            label: stateLabels[s.type],
                          }));
                          return (
                            <div key={state.type}>
                              <div className="flex items-center justify-between py-3 px-4 -mx-4 hover:bg-accent/50 rounded-md transition-colors">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div
                                    className={`flex items-center justify-center w-8 h-8 rounded-md ${
                                      isCompleted
                                        ? "bg-primary text-primary-foreground"
                                        : isNextState(index)
                                          ? "bg-primary/10 text-primary"
                                          : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    <StatusIcon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-foreground">
                                      {stateLabels[state.type]}
                                    </div>
                                    {state.date && (
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        {formatDate(state.date)} ({getRelativeTime(state.date)})
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 relative">
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
                                </div>
                              </div>
                              {index < states.length - 1 && <Separator className="my-1" />}
                            </div>
                          );
                        })}

                        <Separator className="my-3" />

                        {/* Baby Name */}
                        <div className="flex items-center justify-between py-3 px-4 -mx-4 hover:bg-accent/50 rounded-md transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
                              <Baby className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground">Baby Name</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {baby.name}
                              </div>
                            </div>
                          </div>
                          <NameEditor babyId={baby._id} currentName={baby.name} compact />
                        </div>

                        <Separator className="my-3" />

                        {/* Due Date */}
                        <div className="flex items-center justify-between py-3 px-4 -mx-4 hover:bg-accent/50 rounded-md transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground">Due Date</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {format(parseDate(baby.dueDate), "MMMM d, yyyy")}
                              </div>
                            </div>
                          </div>
                          <DueDateEditor babyId={baby._id} currentDueDate={baby.dueDate} compact />
                        </div>

                        <Separator className="my-3" />

                        {/* Custom Message */}
                        <div className="flex items-center justify-between py-3 px-4 -mx-4 hover:bg-accent/50 rounded-md transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
                              <Hospital className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground">
                                Hospital Message
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {baby.customMessage || "Default message"}
                              </div>
                            </div>
                          </div>
                          <CustomMessageEditor
                            babyId={baby._id}
                            currentMessage={baby.customMessage}
                            compact
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}

            {/* Current status display */}
            {!currentStatus && (
              <div className="flex flex-col items-center">
                <Baby className="w-24 h-24 md:w-32 md:h-32 text-primary mb-6" />
                <h2 className="text-2xl md:text-5xl font-bold text-foreground mb-4 whitespace-nowrap">
                  Not yet
                </h2>
                <p className="text-xl text-muted-foreground mb-4">Baby is still on the way</p>
                {overdueDays > 0 && (
                  <div className="mt-4 p-4 bg-primary/20 border border-primary/50 rounded-lg">
                    <p className="text-lg font-semibold text-primary">
                      {overdueDays} {overdueDays === 1 ? "day" : "days"} overdue
                    </p>
                    <p className="text-sm text-primary/80 mt-1">
                      Due date: {format(parseDate(baby.dueDate), "MMMM d, yyyy")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {currentStatus?.type === "labor_started" && (
              <div className="flex flex-col items-center">
                <Activity className="w-24 h-24 md:w-32 md:h-32 text-primary mb-6" />
                <h2 className="text-2xl md:text-5xl font-bold text-foreground mb-4 whitespace-nowrap">
                  Labour started
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
              <div className="flex flex-col items-center">
                <Hospital className="w-24 h-24 md:w-32 md:h-32 text-primary mb-6" />
                <h2 className="text-2xl md:text-5xl font-bold text-foreground mb-4 whitespace-nowrap">
                  Gone to hospital
                </h2>
                {currentStatus.date && (
                  <p className="text-xl text-muted-foreground mb-2">
                    {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
                  </p>
                )}
                {baby.customMessage && (
                  <div className="mt-6 p-4 bg-primary/20 border border-primary/50 rounded-lg w-full max-w-md">
                    <p className="text-lg font-semibold text-primary">{baby.customMessage}</p>
                  </div>
                )}
              </div>
            )}

            {currentStatus?.type === "born" && (
              <div className="flex flex-col items-center">
                <CheckCircle className="w-24 h-24 md:w-32 md:h-32 text-primary mb-6" />
                <h2 className="text-2xl md:text-5xl font-bold text-foreground mb-4 whitespace-nowrap">
                  Yes! Baby is out
                </h2>
                {currentStatus.date && (
                  <p className="text-xl text-muted-foreground">
                    Born on {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
                  </p>
                )}
              </div>
            )}

            {/* Horizontal divider */}
            <Separator className="my-8" />

            {/* Progress indicator */}
            <div>
              <div className="flex items-center justify-between mb-4">
                {states.map((state) => {
                  // For progress bar, show previous statuses as completed if later ones are set
                  const isCompleted = isStateCompletedForProgress(state);
                  const isCurrent = currentStatus?.type === state.type;
                  const Icon = stateIcons[state.type];
                  const classes = getStateClasses(state.type, isCompleted, isCurrent);

                  return (
                    <div key={state.type} className="flex flex-col items-center flex-1">
                      <div
                        className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mb-2 transition-all ${classes.circle}`}
                      >
                        <Icon className="w-8 h-8 md:w-10 md:h-10" />
                      </div>
                      <p className={`text-sm md:text-base font-medium ${classes.text}`}>
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
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${(completedCount / states.length) * 100}%` }}
                />
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
