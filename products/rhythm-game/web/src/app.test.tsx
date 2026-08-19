import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

test("generates a chart, starts a run, accepts input, and shows credits", async () => {
  await using _resource = makeAsyncResource({}, async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1]))));
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

  render(<App />);

  expect(screen.getByRole("heading", { name: "Rhythm Lab" })).toBeTruthy();
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
  expect(play).toHaveBeenCalledOnce();
  const firstLane = screen.getByRole<HTMLButtonElement>("button", { name: "D" });
  expect(firstLane.disabled).toBe(false);

  fireEvent.click(firstLane);
  expect(await screen.findByText("Miss")).toBeTruthy();
  expect(screen.getByText("0 / 1")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Music credits" }));
  expect(await screen.findByText(/recompressed for the prototype/)).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "CC BY 3.0" })).toHaveLength(3);
});
