import { expect, test } from "vitest";
import { getMilestonePolicy, milestoneVisibilityForPreset } from "../src/types";

test("private journey presets map to visibility without becoming stored plan labels", () => {
  expect(milestoneVisibilityForPreset("labour")).toEqual({
    showLabor: true,
    showHospital: true,
  });
  expect(milestoneVisibilityForPreset("home_birth")).toEqual({
    showLabor: true,
    showHospital: false,
  });
  expect(milestoneVisibilityForPreset("planned_c_section")).toEqual({
    showLabor: false,
    showHospital: true,
  });
});

test("legacy babies default to every milestone visible", () => {
  const policy = getMilestonePolicy({
    laborStarted: "2026-08-10T08:00:00.000Z",
    wentToHospital: null,
    babyBorn: null,
  });

  expect(policy.visibility).toEqual({ showLabor: true, showHospital: true });
  expect(policy.visibleMilestones).toEqual(["labor_started", "gone_to_hospital", "born"]);
  expect(policy.currentStatus.type).toBe("labor_started");
  expect(Math.round(policy.progressPercent)).toBe(33);
});

test("hidden milestones are not current or markable while birth remains visible", () => {
  const policy = getMilestonePolicy({
    milestoneVisibility: { showLabor: false, showHospital: false },
    laborStarted: "2026-08-10T08:00:00.000Z",
    wentToHospital: null,
    babyBorn: null,
  });

  expect(policy.visibleMilestones).toEqual(["born"]);
  expect(policy.currentStatus.type).toBe("not_yet");
  expect(policy.canMark("labor_started")).toBe(false);
  expect(policy.canMark("gone_to_hospital")).toBe(false);
  expect(policy.canMark("born")).toBe(true);
  expect(policy.progressPercent).toBe(0);
  expect(policy.visibilityLocked).toBe(false);
});

test("hospital data locks visibility even when that milestone is hidden", () => {
  const policy = getMilestonePolicy({
    milestoneVisibility: { showLabor: true, showHospital: false },
    laborStarted: "2026-08-10T08:00:00.000Z",
    wentToHospital: "2026-08-10T12:00:00.000Z",
    babyBorn: null,
  });

  expect(policy.currentStatus.type).toBe("labor_started");
  expect(policy.progressPercent).toBe(50);
  expect(policy.visibilityLocked).toBe(true);
});
