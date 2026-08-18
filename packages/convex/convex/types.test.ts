import { expect, test } from "vitest";
import {
  getBirthJourney,
  getCurrentStatus,
  getMilestonesForJourney,
  isBirthJourney,
  isMilestoneInJourney,
} from "../src/types";

test("birth journey helpers preserve legacy defaults and planned C-section milestones", () => {
  expect(getBirthJourney({})).toBe("labour");
  expect(getBirthJourney({ birthJourney: "planned_c_section" })).toBe("planned_c_section");
  expect(isBirthJourney("planned_c_section")).toBe(true);
  expect(isBirthJourney("home_birth")).toBe(true);
  expect(isBirthJourney("home_birth")).toBe(false);
  expect(getMilestonesForJourney({ birthJourney: "planned_c_section" })).toEqual([
    "gone_to_hospital",
    "born",
  ]);
  expect(getMilestonesForJourney({ birthJourney: "home_birth" })).toEqual([
    "labor_started",
    "born",
  ]);
  expect(isMilestoneInJourney({ birthJourney: "planned_c_section" }, "labor_started")).toBe(false);
  expect(isMilestoneInJourney({ birthJourney: "planned_c_section" }, "gone_to_hospital")).toBe(
    true,
  );
  expect(
    getCurrentStatus({
      birthJourney: "planned_c_section",
      laborStarted: "2026-08-10T08:00:00.000Z",
    }),
  ).toEqual({ type: "not_yet" });
});
