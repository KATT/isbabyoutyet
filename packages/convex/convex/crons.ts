import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "remove expired demo playgrounds",
  { hours: 6 },
  internal.demoBabies.cleanupExpired,
  {},
);

export default crons;
