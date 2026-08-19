export const laneCount = 4;
export const approachSeconds = 2.15;
export const perfectWindowSeconds = 0.07;
export const goodWindowSeconds = 0.15;

export type ChartNote = {
  id: number;
  time: number;
  lane: number;
  intensity: number;
};

export type HitJudgment = "perfect" | "good" | "miss";

export type GameStats = {
  score: number;
  combo: number;
  maxCombo: number;
  perfects: number;
  goods: number;
  misses: number;
};

type AnalyzeSignalOptions = {
  samples: Float32Array;
  sampleRate: number;
};

type Candidate = {
  frameIndex: number;
  time: number;
  strength: number;
  laneSignature: number;
};

type FindNoteOptions = {
  notes: readonly ChartNote[];
  lane: number;
  currentTime: number;
  judgedNoteIds: ReadonlySet<number>;
};

export function emptyGameStats(): GameStats {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,
    goods: 0,
    misses: 0,
  };
}

export function judgeTiming(offsetSeconds: number): HitJudgment {
  const absoluteOffset = Math.abs(offsetSeconds);
  if (absoluteOffset <= perfectWindowSeconds) {
    return "perfect";
  }
  if (absoluteOffset <= goodWindowSeconds) {
    return "good";
  }
  return "miss";
}

export function applyJudgment(stats: GameStats, judgment: HitJudgment): GameStats {
  if (judgment === "miss") {
    return {
      ...stats,
      combo: 0,
      misses: stats.misses + 1,
    };
  }

  const combo = stats.combo + 1;
  return {
    ...stats,
    score: stats.score + (judgment === "perfect" ? 1_000 : 500) + combo * 10,
    combo,
    maxCombo: Math.max(stats.maxCombo, combo),
    perfects: stats.perfects + (judgment === "perfect" ? 1 : 0),
    goods: stats.goods + (judgment === "good" ? 1 : 0),
  };
}

export function findHittableNote(options: FindNoteOptions): ChartNote | null {
  let nearest: ChartNote | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const note of options.notes) {
    if (note.lane !== options.lane || options.judgedNoteIds.has(note.id)) {
      continue;
    }
    const distance = Math.abs(note.time - options.currentTime);
    if (distance <= goodWindowSeconds && distance < nearestDistance) {
      nearest = note;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function frameMeasurements(options: AnalyzeSignalOptions) {
  const hopSize = Math.max(256, Math.round(options.sampleRate / 43));
  const frameSize = hopSize * 2;
  const frameCount = Math.max(0, Math.floor((options.samples.length - frameSize) / hopSize));
  const energies = new Float32Array(frameCount);
  const laneSignatures = new Uint32Array(frameCount);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * hopSize;
    let energy = 0;
    let zeroCrossings = 0;
    let previous = options.samples[start] ?? 0;

    for (let sampleIndex = start; sampleIndex < start + frameSize; sampleIndex += 1) {
      const sample = options.samples[sampleIndex] ?? 0;
      energy += sample * sample;
      if ((sample >= 0 && previous < 0) || (sample < 0 && previous >= 0)) {
        zeroCrossings += 1;
      }
      previous = sample;
    }

    energies[frameIndex] = Math.sqrt(energy / frameSize);
    laneSignatures[frameIndex] = zeroCrossings;
  }

  return { energies, laneSignatures, hopSize };
}

function onsetCandidates(options: AnalyzeSignalOptions) {
  const measurements = frameMeasurements(options);
  const flux = new Float32Array(measurements.energies.length);
  const lookbackFrames = 12;

  for (
    let frameIndex = lookbackFrames;
    frameIndex < measurements.energies.length;
    frameIndex += 1
  ) {
    let baseline = 0;
    for (
      let previousIndex = frameIndex - lookbackFrames;
      previousIndex < frameIndex;
      previousIndex += 1
    ) {
      baseline += measurements.energies[previousIndex] ?? 0;
    }
    baseline /= lookbackFrames;
    flux[frameIndex] = Math.max(0, (measurements.energies[frameIndex] ?? 0) - baseline);
  }

  const candidates: Candidate[] = [];
  for (let frameIndex = lookbackFrames + 1; frameIndex < flux.length - 1; frameIndex += 1) {
    const strength = flux[frameIndex] ?? 0;
    if (
      strength <= (flux[frameIndex - 1] ?? 0) ||
      strength < (flux[frameIndex + 1] ?? 0) ||
      strength <= 0
    ) {
      continue;
    }
    candidates.push({
      frameIndex,
      time: (frameIndex * measurements.hopSize) / options.sampleRate,
      strength,
      laneSignature: measurements.laneSignatures[frameIndex] ?? 0,
    });
  }

  return candidates;
}

export function generateChartFromSignal(options: AnalyzeSignalOptions): ChartNote[] {
  if (options.sampleRate <= 0 || options.samples.length === 0) {
    return [];
  }

  const duration = options.samples.length / options.sampleRate;
  const targetNoteCount = Math.min(520, Math.max(24, Math.round(duration * 1.9)));
  const ranked = onsetCandidates(options).sort((left, right) => right.strength - left.strength);
  const selected: Candidate[] = [];
  const minimumSpacing = 0.18;

  for (const candidate of ranked) {
    if (candidate.time < 0.6 || candidate.time > duration - 0.4) {
      continue;
    }
    if (selected.some((other) => Math.abs(other.time - candidate.time) < minimumSpacing)) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= targetNoteCount) {
      break;
    }
  }

  selected.sort((left, right) => left.time - right.time);
  const strongest = Math.max(...selected.map((candidate) => candidate.strength), 0.000_001);

  return selected.map((candidate, id) => ({
    id,
    time: candidate.time,
    lane:
      Math.abs(
        Math.round(
          candidate.laneSignature * 0.73 +
            candidate.frameIndex * 0.41 +
            candidate.strength * 10_000,
        ),
      ) % laneCount,
    intensity: Math.min(1, Math.max(0.35, candidate.strength / strongest)),
  }));
}
