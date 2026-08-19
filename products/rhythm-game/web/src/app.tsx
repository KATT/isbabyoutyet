import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AudioLinesIcon,
  InfoIcon,
  KeyboardIcon,
  Music2Icon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SparklesIcon,
} from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/progress";
import {
  approachSeconds,
  applyJudgment,
  emptyGameStats,
  findHittableNote,
  generateChartFromSignal,
  goodWindowSeconds,
  judgeTiming,
  laneCount,
} from "@/gameEngine";
import type { ChartNote, GameStats, HitJudgment } from "@/gameEngine";
import { tracks } from "@/tracks";
import type { Track } from "@/tracks";

type GamePhase = "library" | "analyzing" | "ready" | "playing" | "paused" | "finished";

const laneKeys = ["D", "F", "J", "K"] as const;

function getInitialTrack(): Track {
  const track = tracks.at(0);
  if (!track) {
    throw new Error("At least one track is required");
  }
  return track;
}

const initialTrack = getInitialTrack();

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function mixToMono(audioBuffer: AudioBuffer) {
  const mono = new Float32Array(audioBuffer.length);
  for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
    const channel = audioBuffer.getChannelData(channelIndex);
    for (let sampleIndex = 0; sampleIndex < audioBuffer.length; sampleIndex += 1) {
      mono[sampleIndex] = (mono[sampleIndex] ?? 0) + (channel[sampleIndex] ?? 0);
    }
  }
  const divisor = Math.max(1, audioBuffer.numberOfChannels);
  for (let sampleIndex = 0; sampleIndex < mono.length; sampleIndex += 1) {
    mono[sampleIndex] = (mono[sampleIndex] ?? 0) / divisor;
  }
  return mono;
}

function judgmentLabel(judgment: HitJudgment | null) {
  if (judgment === null) {
    return "";
  }
  switch (judgment) {
    case "perfect":
      return "Perfect";
    case "good":
      return "Good";
    case "miss":
      return "Miss";
  }
}

function noteStyle(note: ChartNote, currentTime: number) {
  const progress = 1 - (note.time - currentTime) / approachSeconds;
  return {
    top: `${Math.min(92, Math.max(-8, progress * 82))}%`,
    "--note-intensity": note.intensity,
  } as CSSProperties;
}

function accuracy(stats: GameStats) {
  const total = stats.perfects + stats.goods + stats.misses;
  if (total === 0) {
    return 100;
  }
  return Math.round(((stats.perfects + stats.goods * 0.65) / total) * 100);
}

export function App() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const judgedNoteIdsRef = useRef(new Set<number>());
  const missedNoteCursorRef = useRef(0);
  const analysisRequestRef = useRef(0);
  const [phase, setPhase] = useState<GamePhase>("library");
  const [selectedTrack, setSelectedTrack] = useState<Track>(initialTrack);
  const [chart, setChart] = useState<ChartNote[]>([]);
  const [judgedNoteIds, setJudgedNoteIds] = useState<ReadonlySet<number>>(new Set());
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [stats, setStats] = useState(emptyGameStats);
  const [lastJudgment, setLastJudgment] = useState<HitJudgment | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "playing") {
      return;
    }

    let animationFrame = 0;
    function updateGame() {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      const playbackTime = audio.currentTime;
      setCurrentTime(playbackTime);
      let missedNotes = 0;
      while (
        missedNoteCursorRef.current < chart.length &&
        (chart[missedNoteCursorRef.current]?.time ?? Number.POSITIVE_INFINITY) <
          playbackTime - goodWindowSeconds
      ) {
        const note = chart[missedNoteCursorRef.current];
        missedNoteCursorRef.current += 1;
        if (note && !judgedNoteIdsRef.current.has(note.id)) {
          judgedNoteIdsRef.current.add(note.id);
          missedNotes += 1;
        }
      }
      if (missedNotes > 0) {
        setJudgedNoteIds(new Set(judgedNoteIdsRef.current));
        setStats((currentStats) => {
          let nextStats = currentStats;
          for (let missIndex = 0; missIndex < missedNotes; missIndex += 1) {
            nextStats = applyJudgment(nextStats, "miss");
          }
          return nextStats;
        });
        setLastJudgment("miss");
      }

      if (!audio.ended) {
        animationFrame = requestAnimationFrame(updateGame);
      }
    }

    animationFrame = requestAnimationFrame(updateGame);
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [chart, phase]);

  useEffect(() => {
    if (phase !== "playing") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return;
      }
      const lane = laneKeys.indexOf(event.key.toUpperCase() as (typeof laneKeys)[number]);
      if (lane >= 0) {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>(`[data-game-lane="${lane}"]`)?.click();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [phase]);

  async function analyzeTrack(track: Track) {
    const requestId = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestId;
    audioRef.current?.pause();
    setSelectedTrack(track);
    setPhase("analyzing");
    setAnalysisError(null);
    setChart([]);
    setJudgedNoteIds(new Set());
    setCurrentTime(0);
    setStats(emptyGameStats());
    setLastJudgment(null);

    try {
      const response = await fetch(track.audioUrl);
      if (!response.ok) {
        throw new Error(`Audio request failed with status ${response.status}`);
      }
      const encodedAudio = await response.arrayBuffer();
      const context = new AudioContext();
      const decodedAudio = await context.decodeAudioData(encodedAudio);
      const generatedChart = generateChartFromSignal({
        samples: mixToMono(decodedAudio),
        sampleRate: decodedAudio.sampleRate,
      });
      await context.close();

      if (requestId !== analysisRequestRef.current) {
        return;
      }
      if (generatedChart.length === 0) {
        throw new Error("No playable beats were detected");
      }
      setChart(generatedChart);
      setDuration(decodedAudio.duration);
      setPhase("ready");
    } catch (error) {
      if (requestId !== analysisRequestRef.current) {
        return;
      }
      setAnalysisError(error instanceof Error ? error.message : "Unable to analyze this track");
      setPhase("library");
    }
  }

  async function startGame() {
    const audio = audioRef.current;
    if (!audio || chart.length === 0) {
      return;
    }
    judgedNoteIdsRef.current = new Set();
    setJudgedNoteIds(new Set());
    missedNoteCursorRef.current = 0;
    setStats(emptyGameStats());
    setCurrentTime(0);
    setLastJudgment(null);
    audio.currentTime = 0;
    await audio.play();
    setPhase("playing");
  }

  async function togglePause() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (phase === "playing") {
      audio.pause();
      setPhase("paused");
      return;
    }
    await audio.play();
    setPhase("playing");
  }

  function registerLaneHit(lane: number) {
    const audio = audioRef.current;
    if (!audio || phase !== "playing") {
      return;
    }
    const note = findHittableNote({
      notes: chart,
      lane,
      currentTime: audio.currentTime,
      judgedNoteIds: judgedNoteIdsRef.current,
    });
    if (!note) {
      setStats((currentStats) => applyJudgment(currentStats, "miss"));
      setLastJudgment("miss");
      return;
    }
    judgedNoteIdsRef.current.add(note.id);
    setJudgedNoteIds(new Set(judgedNoteIdsRef.current));
    const judgment = judgeTiming(note.time - audio.currentTime);
    setStats((currentStats) => applyJudgment(currentStats, judgment));
    setLastJudgment(judgment);
  }

  function finishGame() {
    setCurrentTime(duration);
    setPhase("finished");
  }

  function returnToLibrary() {
    audioRef.current?.pause();
    setPhase("library");
    setChart([]);
    setJudgedNoteIds(new Set());
    setCurrentTime(0);
    setLastJudgment(null);
  }

  const visibleNotes =
    phase === "playing" || phase === "paused"
      ? chart.filter(
          (note) =>
            !judgedNoteIds.has(note.id) &&
            note.time >= currentTime - goodWindowSeconds &&
            note.time <= currentTime + approachSeconds,
        )
      : [];
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <audio ref={audioRef} src={selectedTrack.audioUrl} onEnded={finishGame} preload="auto" />

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <AudioLinesIcon className="size-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">Rhythm Lab</h1>
              <Badge variant="secondary">Prototype</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Every chart is generated from the audio.
            </p>
          </div>
        </div>

        <Dialog>
          <DialogTrigger render={<Button variant="ghost" />}>
            <InfoIcon data-icon="inline-start" />
            Music credits
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Music credits</DialogTitle>
              <DialogDescription>
                These recordings are used under Creative Commons Attribution 3.0 and were
                recompressed for the prototype.
              </DialogDescription>
            </DialogHeader>
            <div className="flex max-h-80 flex-col gap-4 overflow-y-auto">
              {tracks.map((track) => (
                <div key={track.id} className="flex flex-col gap-1">
                  <p className="font-medium">{track.title} — Kevin MacLeod</p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <a
                      className="text-primary underline underline-offset-4"
                      href={track.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source
                    </a>
                    <a
                      className="text-primary underline underline-offset-4"
                      href={track.licenseUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      CC BY 3.0
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>{selectedTrack.title}</CardTitle>
            <CardDescription>
              {phase === "library"
                ? "Choose a track below to generate a fresh chart."
                : `${selectedTrack.artist} · ${selectedTrack.mood}`}
            </CardDescription>
            <CardAction>
              <Badge variant="outline">
                {chart.length > 0 ? `${chart.length} notes` : "4 lanes"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rhythm-stage" aria-label="Four-lane rhythm game">
              <div className="rhythm-lanes" aria-hidden="true">
                {Array.from({ length: laneCount }, (_, lane) => (
                  <div key={lane} className="rhythm-lane" data-lane={lane}>
                    {visibleNotes
                      .filter((note) => note.lane === lane)
                      .map((note) => (
                        <div
                          key={note.id}
                          className="rhythm-note"
                          style={noteStyle(note, currentTime)}
                        />
                      ))}
                  </div>
                ))}
              </div>
              <div className="rhythm-hit-line" aria-hidden="true" />
              {lastJudgment ? (
                <p className="rhythm-judgment" aria-live="polite">
                  {judgmentLabel(lastJudgment)}
                </p>
              ) : null}

              {phase === "analyzing" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 px-6 text-center backdrop-blur-sm">
                  <SparklesIcon className="size-10 text-primary" aria-hidden="true" />
                  <p className="text-xl font-bold">Listening for beats…</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Measuring energy changes and transients locally in your browser.
                  </p>
                </div>
              ) : null}

              {phase === "ready" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 px-6 text-center backdrop-blur-sm">
                  <Badge variant="secondary">{chart.length} beats detected</Badge>
                  <p className="max-w-sm text-2xl font-black">
                    Your chart is ready. Hit notes at the glowing line.
                  </p>
                  <Button size="lg" onClick={() => void startGame()}>
                    <PlayIcon data-icon="inline-start" />
                    Start run
                  </Button>
                </div>
              ) : null}

              {phase === "finished" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 px-6 text-center backdrop-blur-sm">
                  <Badge variant="secondary">Run complete</Badge>
                  <p className="text-5xl font-black tabular-nums">{stats.score.toLocaleString()}</p>
                  <p className="text-muted-foreground">
                    {accuracy(stats)}% accuracy · {stats.maxCombo} max combo
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => void startGame()}>
                      <RotateCcwIcon data-icon="inline-start" />
                      Play again
                    </Button>
                    <Button variant="outline" onClick={returnToLibrary}>
                      Pick another song
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {laneKeys.map((key, lane) => (
                <Button
                  key={key}
                  variant="outline"
                  className="rhythm-pad text-lg font-black"
                  data-lane={lane}
                  data-game-lane={lane}
                  disabled={phase !== "playing"}
                  onClick={() => registerLaneHit(lane)}
                >
                  {key}
                </Button>
              ))}
            </div>

            <Progress value={progress}>
              <ProgressLabel>{formatTime(currentTime)}</ProgressLabel>
              <ProgressValue>{() => formatTime(duration)}</ProgressValue>
            </Progress>
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <KeyboardIcon className="size-4" aria-hidden="true" />
              Keyboard or touch
            </div>
            {phase === "playing" || phase === "paused" ? (
              <Button variant="outline" onClick={() => void togglePause()}>
                {phase === "playing" ? (
                  <PauseIcon data-icon="inline-start" />
                ) : (
                  <PlayIcon data-icon="inline-start" />
                )}
                {phase === "playing" ? "Pause" : "Resume"}
              </Button>
            ) : null}
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Live score</CardTitle>
              <CardDescription>Your timing updates on every hit.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Score</p>
                <p className="text-2xl font-black tabular-nums">{stats.score.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Combo</p>
                <p className="text-2xl font-black tabular-nums">{stats.combo}×</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Perfect</p>
                <p className="text-xl font-bold tabular-nums">{stats.perfects}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Good / miss
                </p>
                <p className="text-xl font-bold tabular-nums">
                  {stats.goods} / {stats.misses}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>How charts work</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>The browser decodes each licensed MP3 without uploading it.</p>
              <p>Energy spikes become notes; waveform changes distribute them across four lanes.</p>
              <p>No Spotify APIs, streams, or user data are involved.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="track-library-title">
        <div>
          <h2 id="track-library-title" className="text-xl font-black">
            Pick a track
          </h2>
          <p className="text-sm text-muted-foreground">
            Popular creator tracks licensed for reuse with attribution.
          </p>
        </div>
        {analysisError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {analysisError}
          </p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          {tracks.map((track) => (
            <Card key={track.id} size="sm">
              <CardHeader>
                <CardTitle>{track.title}</CardTitle>
                <CardDescription>{track.artist}</CardDescription>
                <CardAction>
                  <Badge variant="outline">{track.bpm} BPM</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{track.mood}</span>
                <span className="tabular-nums">{track.durationLabel}</span>
              </CardContent>
              <CardFooter className="justify-between gap-3">
                <span className="text-xs text-muted-foreground">CC BY 3.0</span>
                <Button
                  variant={
                    selectedTrack.id === track.id && phase !== "library" ? "secondary" : "default"
                  }
                  disabled={phase === "analyzing"}
                  onClick={() => void analyzeTrack(track)}
                >
                  <Music2Icon data-icon="inline-start" />
                  Generate chart
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
