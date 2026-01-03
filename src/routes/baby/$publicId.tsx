import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { Baby, Hospital, CheckCircle, Activity } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";

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

type StatusUpdateButtonProps = {
  babyId: string;
  status: "labor_started" | "gone_to_hospital" | "born";
  currentStatus: string | null;
  label: string;
  icon: React.ReactNode;
};

function StatusUpdateButton({
  babyId,
  status,
  currentStatus,
  label,
  icon,
}: StatusUpdateButtonProps) {
  const updateStatus = useMutation(api.babies.updateStatus);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const dateString = now.toISOString();
      await updateStatus({
        babyId: babyId as any,
        status,
        date: dateString,
      });
    } catch (err) {
      // Error handling - could be improved with proper logging
      if (err instanceof Error) {
        // Handle error appropriately
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isCompleted = currentStatus === status;
  const isDisabled = isCompleted || isLoading;

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant={isCompleted ? "default" : "outline"}
      className="w-full"
    >
      {icon}
      {isCompleted ? `${label} (Completed)` : `Mark as ${label}`}
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
  const { publicId } = Route.useParams();
  const babyData = useQuery(api.babies.getByPublicId, { publicId });
  const { data: session } = useSession();

  if (babyData === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  if (babyData === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Baby not found</div>
      </div>
    );
  }

  const { statusUpdates, ...baby } = babyData;
  // Better-auth user ID is in session.user.id, but Convex uses identity.subject which is the same
  const isOwner = session?.user?.id === baby.userId;

  // Determine current status
  const statusMap = {
    labor_started:
      statusUpdates.find((s: { status: string }) => s.status === "labor_started")?.date || null,
    gone_to_hospital:
      statusUpdates.find((s: { status: string }) => s.status === "gone_to_hospital")?.date || null,
    born: statusUpdates.find((s: { status: string }) => s.status === "born")?.date || null,
  };

  const states = [
    { type: "labor_started" as const, date: statusMap.labor_started },
    { type: "gone_to_hospital" as const, date: statusMap.gone_to_hospital },
    { type: "born" as const, date: statusMap.born },
  ];

  let currentIndex = -1;
  for (let i = states.length - 1; i >= 0; i--) {
    if (states[i].date) {
      currentIndex = i;
      break;
    }
  }
  const currentStatus = currentIndex >= 0 ? states[currentIndex] : null;
  const completedCount = states.filter((s) => s.date).length;

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
      <h1 className="sticky top-0 z-10 text-3xl md:text-6xl font-black text-foreground tracking-[-0.08em] whitespace-nowrap py-4 md:py-8 px-6 text-center">
        <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
          Is {baby.name} out yet?
        </span>
      </h1>
      <section className="relative px-6 text-center overflow-hidden">
        <div className="relative max-w-4xl mx-auto">
          <div className="bg-card border rounded-2xl p-8 md:p-12 shadow-2xl">
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
                <div className="mt-6 p-4 bg-primary/20 border border-primary/50 rounded-lg">
                  <p className="text-lg font-semibold text-primary">
                    Do not disturb, only send messages to the parents
                  </p>
                </div>
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
            <div className="my-8 border-t border"></div>

            {/* Progress indicator */}
            <div>
              <div className="flex items-center justify-between mb-4">
                {states.map((state, index) => {
                  const isCompleted = !!state.date;
                  const isCurrent = index === currentIndex;
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

            {/* Owner-only status update buttons */}
            {isOwner && (
              <>
                <div className="my-8 border-t border"></div>
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Update Status</h3>
                  <StatusUpdateButton
                    babyId={baby._id}
                    status="labor_started"
                    currentStatus={statusMap.labor_started}
                    label="Labour Started"
                    icon={<Activity className="w-4 h-4" />}
                  />
                  <StatusUpdateButton
                    babyId={baby._id}
                    status="gone_to_hospital"
                    currentStatus={statusMap.gone_to_hospital}
                    label="Gone to Hospital"
                    icon={<Hospital className="w-4 h-4" />}
                  />
                  <StatusUpdateButton
                    babyId={baby._id}
                    status="born"
                    currentStatus={statusMap.born}
                    label="Baby Born"
                    icon={<CheckCircle className="w-4 h-4" />}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
