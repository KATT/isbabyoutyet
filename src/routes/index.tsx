import { createFileRoute } from "@tanstack/react-router";
import { Baby, Hospital, CheckCircle, Activity } from "lucide-react";

// Type definitions
type StatusState = {
  type: "labor_started" | "gone_to_hospital" | "born";
  date?: string; // date string in "YYYY-MM-DD HH:mm" format
};

// Status data - tuple of states in order
// Update dates as events happen
const states: [
  StatusState & { type: "labor_started" },
  StatusState & { type: "gone_to_hospital" },
  StatusState & { type: "born" },
] = [
  {
    type: "labor_started",
    // date: "2026-01-03 12:00",
  },
  {
    type: "gone_to_hospital",
    // date: "2026-01-03 12:00",
  },
  {
    type: "born",
    // date: "2026-01-03 11:00",
  },
];

export const Route = createFileRoute("/")({
  component: App,
  head: () => {
    // Calculate current status for dynamic title
    let currentIndex = -1;
    for (let i = states.length - 1; i >= 0; i--) {
      if (states[i].date) {
        currentIndex = i;
        break;
      }
    }
    const currentStatus = currentIndex >= 0 ? states[currentIndex] : null;

    let title = "Is Baby Darvill out yet?";
    let description = "Track the progress of labour and birth - know when baby arrives!";

    if (currentStatus) {
      switch (currentStatus.type) {
        case "labor_started":
          title = "Labour started - Is Baby Darvill out yet?";
          description = "Labour has started! Track the progress.";
          break;
        case "gone_to_hospital":
          title = "Gone to hospital - Is Baby Darvill out yet?";
          description = "At the hospital! Baby is on the way.";
          break;
        case "born":
          title = "Yes! Baby Darvill is out! 🎉";
          description = "Baby Darvill has arrived!";
          break;
      }
    } else {
      const overdueDays = getOverdueDays();
      if (overdueDays > 0) {
        title = `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue - Is Baby Darvill out yet?`;
        description = `Baby is ${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue. Still waiting!`;
      }
    }

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
          property: "og:title",
          content: title,
        },
        {
          property: "og:description",
          content: description,
        },
        {
          property: "og:type",
          content: "website",
        },
        {
          name: "twitter:card",
          content: "summary",
        },
        {
          name: "twitter:title",
          content: title,
        },
        {
          name: "twitter:description",
          content: description,
        },
      ],
    };
  },
});

// Timezone for all states (Malmö, Sweden)
const TIMEZONE = "Europe/Stockholm";

// Helper function to calculate overdue days from due date (31st December 2025)
function getOverdueDays(): number {
  const now = new Date();

  // Get current date in Stockholm timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const nowParts = formatter.formatToParts(now);
  const currentYear = parseInt(nowParts.find((p) => p.type === "year")!.value);
  const currentMonth = parseInt(nowParts.find((p) => p.type === "month")!.value);
  const currentDay = parseInt(nowParts.find((p) => p.type === "day")!.value);

  // Due date is 31st December 2025
  const dueYear = 2025;
  const dueMonth = 12;
  const dueDay = 31;

  // Calculate difference in calendar days
  const currentDate = new Date(currentYear, currentMonth - 1, currentDay);
  const dueDate = new Date(dueYear, dueMonth - 1, dueDay);

  const diffInMs = currentDate.getTime() - dueDate.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffInDays);
}

// Helper function to parse date string "YYYY-MM-DD HH:mm" in the specified timezone
// The date string represents a time in Stockholm timezone
function parseDate(dateString: string): Date {
  const [datePart, timePart] = dateString.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);

  // Create an ISO string (will be interpreted as local time by Date constructor)
  const isoString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  let candidate = new Date(isoString);

  // Use Intl to check what this date represents in Stockholm timezone
  // and adjust until we get the correct Stockholm time
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Binary search approach: adjust the date until it represents the correct time in Stockholm
  for (let i = 0; i < 10; i++) {
    const parts = formatter.formatToParts(candidate);
    const stockholmYear = parseInt(parts.find((p) => p.type === "year")!.value);
    const stockholmMonth = parseInt(parts.find((p) => p.type === "month")!.value);
    const stockholmDay = parseInt(parts.find((p) => p.type === "day")!.value);
    const stockholmHour = parseInt(parts.find((p) => p.type === "hour")!.value);
    const stockholmMinute = parseInt(parts.find((p) => p.type === "minute")!.value);

    // Check if we have the right time
    if (
      stockholmYear === year &&
      stockholmMonth === month &&
      stockholmDay === day &&
      stockholmHour === hours &&
      stockholmMinute === minutes
    ) {
      return candidate;
    }

    // Calculate the difference and adjust
    const targetTime = new Date(year, month - 1, day, hours, minutes).getTime();
    const actualTime = new Date(
      stockholmYear,
      stockholmMonth - 1,
      stockholmDay,
      stockholmHour,
      stockholmMinute,
    ).getTime();
    const diff = targetTime - actualTime;
    candidate = new Date(candidate.getTime() + diff);
  }

  return candidate;
}

// Helper function to format date using Intl API
function formatDate(dateString: string): string {
  const date = parseDate(dateString);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    dateStyle: "long",
    timeStyle: "short",
  });
  return formatter.format(date);
}

// Helper function to get relative time using Intl API
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

function App() {
  // Find the latest completed status (last state with a date, or null if none)
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
    stateType: StatusState["type"],
    isCompleted: boolean,
    isCurrent: boolean,
  ) => {
    if (isCompleted) {
      switch (stateType) {
        case "labor_started":
          return {
            circle: "bg-orange-500 text-white",
            text: "text-white",
          };
        case "gone_to_hospital":
          return {
            circle: "bg-orange-600 text-white",
            text: "text-white",
          };
        case "born":
          return {
            circle: "bg-orange-700 text-white",
            text: "text-white",
          };
      }
    }
    if (isCurrent) {
      switch (stateType) {
        case "labor_started":
          return {
            circle: "bg-orange-500/50 border-2 border-orange-400 text-orange-300",
            text: "text-orange-300",
          };
        case "gone_to_hospital":
          return {
            circle: "bg-orange-600/50 border-2 border-orange-500 text-orange-200",
            text: "text-orange-200",
          };
        case "born":
          return {
            circle: "bg-orange-700/50 border-2 border-orange-600 text-orange-200",
            text: "text-orange-200",
          };
      }
    }
    return {
      circle: "bg-slate-700 text-slate-500",
      text: "text-slate-500",
    };
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900">
      <h1 className="sticky top-0 z-10 text-3xl md:text-6xl font-black text-white tracking-[-0.08em] whitespace-nowrap py-4 md:py-8 px-6 text-center">
        <span className="bg-linear-to-r from-orange-300 to-orange-500 bg-clip-text text-transparent">
          Is Baby Darvill out yet?
        </span>
      </h1>
      <section className="relative px-6 text-center overflow-hidden">
        <div className="relative max-w-4xl mx-auto">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 md:p-12 shadow-2xl">
            {/* Current status display */}
            {!currentStatus && (
              <div className="flex flex-col items-center">
                <Baby className="w-24 h-24 md:w-32 md:h-32 text-orange-300 mb-6" />
                <h2 className="text-2xl md:text-5xl font-bold text-white mb-4 whitespace-nowrap">
                  Not yet
                </h2>
                <p className="text-xl text-gray-300 mb-4">Baby is still on the way</p>
                {(() => {
                  const overdueDays = getOverdueDays();
                  if (overdueDays > 0) {
                    return (
                      <div className="mt-4 p-4 bg-orange-600/20 border border-orange-500/50 rounded-lg">
                        <p className="text-lg font-semibold text-orange-200">
                          {overdueDays} {overdueDays === 1 ? "day" : "days"} overdue
                        </p>
                        <p className="text-sm text-orange-300/80 mt-1">Due date: 31st December</p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {currentStatus?.type === "labor_started" && (
              <div className="flex flex-col items-center">
                <Activity className="w-24 h-24 md:w-32 md:h-32 text-orange-300 mb-6" />
                <h2 className="text-2xl md:text-5xl font-bold text-white mb-4 whitespace-nowrap">
                  Labour started
                </h2>
                <p className="text-xl text-gray-300 mb-2">Not gone to hospital yet</p>
                {currentStatus.date && (
                  <p className="text-lg text-gray-400 mt-2">
                    Started at {formatDate(currentStatus.date)} (
                    {getRelativeTime(currentStatus.date)})
                  </p>
                )}
              </div>
            )}

            {currentStatus?.type === "gone_to_hospital" && (
              <div className="flex flex-col items-center">
                <Hospital className="w-24 h-24 md:w-32 md:h-32 text-orange-400 mb-6" />
                <h2 className="text-2xl md:text-5xl font-bold text-white mb-4 whitespace-nowrap">
                  Gone to hospital
                </h2>
                {currentStatus.date && (
                  <p className="text-xl text-gray-300 mb-2">
                    {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
                  </p>
                )}
                <div className="mt-6 p-4 bg-orange-600/20 border border-orange-500/50 rounded-lg">
                  <p className="text-lg font-semibold text-orange-200">
                    Do not disturb, only send messages to Alex
                  </p>
                </div>
              </div>
            )}

            {currentStatus?.type === "born" && (
              <div className="flex flex-col items-center">
                <CheckCircle className="w-24 h-24 md:w-32 md:h-32 text-orange-500 mb-6" />
                <h2 className="text-2xl md:text-5xl font-bold text-white mb-4 whitespace-nowrap">
                  Yes! Baby is out
                </h2>
                {currentStatus.date && (
                  <p className="text-xl text-gray-300">
                    Born on {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
                  </p>
                )}
              </div>
            )}

            {/* Horizontal divider */}
            <div className="my-8 border-t border-slate-700"></div>

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
                        <p className="text-xs text-slate-400 mt-1">{getRelativeTime(state.date)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-orange-600 via-orange-500 to-orange-700 transition-all duration-500"
                  style={{ width: `${(completedCount / states.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
