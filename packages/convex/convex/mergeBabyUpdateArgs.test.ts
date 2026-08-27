import { expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { mergeBabyUpdateArgs } from "../src/mergeBabyUpdateArgs";

const babyId = "jd7baby000000000000000000" as Id<"baby">;

const stored = {
  dueDate: "2026-09-01",
  dueDateDisplayMode: "exact" as const,
  publicDueDateText: null,
  name: "Baby Smith",
  theme: "baby-blue",
  locale: "en-GB" as const,
  birthJourney: "labor" as const,
};

test("omitted patch fields keep the stored baby values", () => {
  expect(
    mergeBabyUpdateArgs({
      baby: stored,
      patch: { babyId },
    }),
  ).toEqual({
    babyId,
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    name: "Baby Smith",
    theme: "baby-blue",
    locale: "en-GB",
    birthJourney: "labor",
  });
});

test("provided patch fields replace the stored values including null", () => {
  expect(
    mergeBabyUpdateArgs({
      baby: stored,
      patch: {
        babyId,
        dueDate: null,
        dueDateDisplayMode: "message",
        publicDueDateText: "any day now",
        name: "Nova Rae",
        theme: null,
        locale: null,
        birthJourney: "home_birth",
      },
    }),
  ).toEqual({
    babyId,
    dueDate: null,
    dueDateDisplayMode: "message",
    publicDueDateText: "any day now",
    name: "Nova Rae",
    theme: null,
    locale: null,
    birthJourney: "home_birth",
  });
});

test("missing stored theme and locale become null when the patch omits them", () => {
  expect(
    mergeBabyUpdateArgs({
      baby: {
        ...stored,
        theme: undefined,
        locale: undefined,
      },
      patch: { babyId },
    }),
  ).toMatchObject({
    theme: null,
    locale: null,
  });
});
