import { describe, expect, test } from "vitest";

import {
  applyJudgment,
  emptyGameStats,
  findHittableNote,
  generateChartFromSignal,
  goodWindowSeconds,
  judgeTiming,
  laneCount,
} from "@/gameEngine";

describe("timing judgments", () => {
  test("uses perfect, good, and miss windows", () => {
    expect(judgeTiming(0.07)).toBe("perfect");
    expect(judgeTiming(-0.07)).toBe("perfect");
    expect(judgeTiming(goodWindowSeconds)).toBe("good");
    expect(judgeTiming(goodWindowSeconds + 0.001)).toBe("miss");
  });

  test("updates score, combo, accuracy buckets, and misses", () => {
    const perfect = applyJudgment(emptyGameStats(), "perfect");
    const good = applyJudgment(perfect, "good");
    const miss = applyJudgment(good, "miss");

    expect(perfect).toMatchObject({ score: 1_010, combo: 1, perfects: 1 });
    expect(good).toMatchObject({ score: 1_530, combo: 2, goods: 1, maxCombo: 2 });
    expect(miss).toMatchObject({ score: 1_530, combo: 0, misses: 1, maxCombo: 2 });
  });
});

test("finds the nearest unjudged note in the requested lane", () => {
  const notes = [
    { id: 0, time: 1, lane: 0, intensity: 1 },
    { id: 1, time: 1.04, lane: 0, intensity: 1 },
    { id: 2, time: 1.01, lane: 1, intensity: 1 },
  ];

  expect(
    findHittableNote({
      notes,
      lane: 0,
      currentTime: 1.03,
      judgedNoteIds: new Set([1]),
    }),
  ).toEqual(notes[0]);
  expect(
    findHittableNote({
      notes,
      lane: 3,
      currentTime: 1,
      judgedNoteIds: new Set(),
    }),
  ).toBeNull();
});

test("generates ordered, spaced notes from synthetic audio transients", () => {
  const sampleRate = 2_000;
  const samples = new Float32Array(sampleRate * 10);
  for (let second = 1; second < 9; second += 1) {
    const pulseStart = second * sampleRate;
    for (let offset = 0; offset < 180; offset += 1) {
      samples[pulseStart + offset] = Math.sin(offset / 3) * (1 - offset / 180);
    }
  }

  const chart = generateChartFromSignal({ samples, sampleRate });

  expect(chart.length).toBeGreaterThanOrEqual(7);
  expect(chart.every((note) => note.lane >= 0 && note.lane < laneCount)).toBe(true);
  expect(chart.every((note) => note.intensity >= 0.35 && note.intensity <= 1)).toBe(true);
  for (let index = 1; index < chart.length; index += 1) {
    expect((chart[index]?.time ?? 0) - (chart[index - 1]?.time ?? 0)).toBeGreaterThanOrEqual(0.18);
  }
});

test("returns no notes for missing audio", () => {
  expect(generateChartFromSignal({ samples: new Float32Array(), sampleRate: 44_100 })).toEqual([]);
  expect(generateChartFromSignal({ samples: new Float32Array([1]), sampleRate: 0 })).toEqual([]);
});
