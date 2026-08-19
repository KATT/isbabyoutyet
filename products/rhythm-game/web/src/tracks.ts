export type Track = {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  sourceUrl: string;
  licenseUrl: string;
  bpm: number;
  durationLabel: string;
  mood: string;
};

export const tracks = [
  {
    id: "monkeys-spinning-monkeys",
    title: "Monkeys Spinning Monkeys",
    artist: "Kevin MacLeod",
    audioUrl: "/audio/monkeys-spinning-monkeys.mp3",
    sourceUrl: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400011",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    bpm: 144,
    durationLabel: "2:05",
    mood: "Bright · Bouncy",
  },
  {
    id: "sneaky-snitch",
    title: "Sneaky Snitch",
    artist: "Kevin MacLeod",
    audioUrl: "/audio/sneaky-snitch.mp3",
    sourceUrl: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100772",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    bpm: 87,
    durationLabel: "2:17",
    mood: "Mysterious · Playful",
  },
  {
    id: "local-forecast",
    title: "Local Forecast",
    artist: "Kevin MacLeod",
    audioUrl: "/audio/local-forecast.mp3",
    sourceUrl: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300010",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    bpm: 93,
    durationLabel: "2:45",
    mood: "Grooving · Jazz",
  },
] as const satisfies readonly Track[];
