import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { App } from "@/app";
import { makeAsyncResource } from "@/test.resource";

function syntheticTrack() {
  const sampleRate = 2_000;
  const samples = new Float32Array(sampleRate * 10);
  for (let second = 1; second < 9; second += 1) {
    const pulseStart = second * sampleRate;
    for (let offset = 0; offset < 180; offset += 1) {
      samples[pulseStart + offset] = Math.sin(offset / 3) * (1 - offset / 180);
    }
  }
  return { sampleRate, samples };
}

function installAudioMocks(options: { responseOk: boolean }) {
  const animationCallbacks: FrameRequestCallback[] = [];
  const track = syntheticTrack();
  class FakeAudioContext {
    async decodeAudioData(_encodedAudio: ArrayBuffer) {
      return {
        length: track.samples.length,
        numberOfChannels: 1,
        sampleRate: track.sampleRate,
        duration: track.samples.length / track.sampleRate,
        getChannelData: (_channelIndex: number) => track.samples,
      } as AudioBuffer;
    }

    async close() {}
  }

  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      options.responseOk ? new Response(new Uint8Array([1])) : new Response(null, { status: 503 }),
    ),
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      animationCallbacks.push(callback);
      return animationCallbacks.length;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

  return { animationCallbacks, pause, play };
}

function testCleanupResource() {
  return makeAsyncResource({}, async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
}

test("plays a generated chart through input, pause, results, and replay", async () => {
  await using _resource = testCleanupResource();
  const mocks = installAudioMocks({ responseOk: true });

  render(<App />);

  expect(screen.getByRole("heading", { name: "Rhythm Lab" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Music credits" }));
  expect(await screen.findByText(/recompressed for the prototype/)).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "CC BY 3.0" })).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  const generateButtons = screen.getAllByRole("button", { name: "Generate chart" });
  expect(generateButtons).toHaveLength(3);
  const firstGenerateButton = generateButtons.at(0);
  if (!firstGenerateButton) {
    throw new Error("Generate chart button not found");
  }

  fireEvent.click(firstGenerateButton);
  const startButton = await screen.findByRole("button", { name: "Start run" });
  expect(screen.getByText(/beats detected/)).toBeTruthy();

  fireEvent.click(startButton);
  expect(mocks.play).toHaveBeenCalledOnce();
  const audio = document.querySelector("audio");
  if (!audio) {
    throw new Error("Audio element not found");
  }
  const laneButtons = ["D", "F", "J", "K"].map((name) =>
    screen.getByRole<HTMLButtonElement>("button", { name }),
  );
  await vi.waitFor(() => {
    expect(laneButtons.every((button) => !button.disabled)).toBe(true);
  });

  audio.currentTime = 1.792;
  fireEvent.keyDown(window, { key: "j" });
  for (const laneButton of laneButtons) {
    fireEvent.click(laneButton);
  }
  const scoreText = screen.getByLabelText("Score value").textContent ?? "0";
  expect(Number(scoreText.replaceAll(",", ""))).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  expect(mocks.pause).toHaveBeenCalled();
  const resumeButton = screen.getByRole("button", { name: "Resume" });
  fireEvent.click(resumeButton);
  expect(mocks.play).toHaveBeenCalledTimes(2);

  audio.currentTime = 3;
  const animationCallback = mocks.animationCallbacks.at(0);
  if (!animationCallback) {
    throw new Error("Animation callback not registered");
  }
  act(() => {
    animationCallback(0);
  });

  fireEvent.ended(audio);
  expect(await screen.findByText("Run complete")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Play again" }));
  expect(mocks.play).toHaveBeenCalledTimes(3);
  fireEvent.ended(audio);
  fireEvent.click(await screen.findByRole("button", { name: "Pick another song" }));
  expect(screen.getByText(/Choose a track below/)).toBeTruthy();
});

test("reports an audio request failure and returns to the library", async () => {
  await using _resource = testCleanupResource();
  installAudioMocks({ responseOk: false });

  render(<App />);
  const generateButtons = screen.getAllByRole("button", { name: "Generate chart" });
  const secondGenerateButton = generateButtons.at(1);
  if (!secondGenerateButton) {
    throw new Error("Generate chart button not found");
  }
  fireEvent.click(secondGenerateButton);
  expect(await screen.findByText(/status 503/)).toBeTruthy();
  expect(screen.getByText(/Choose a track below/)).toBeTruthy();
});
