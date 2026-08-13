import type { Milestone } from "./types";

export const HOMEPAGE_DEMO_PHOTO_KEYS = ["bump", "bag", "labor", "hospital", "born"] as const;

export type HomepageDemoPhotoKey = (typeof HOMEPAGE_DEMO_PHOTO_KEYS)[number];

export const HOMEPAGE_DEMO_PHOTO_FILES: Record<HomepageDemoPhotoKey, string> = {
  bump: "bump.jpg",
  bag: "bag.jpg",
  labor: "labor.jpg",
  hospital: "hospital.jpg",
  born: "born.jpg",
};

/** Due date is two days before "now" — slightly overdue when labour starts. */
export const HOMEPAGE_DEMO_DUE_DATE_MINUTES_AGO = 48 * 60;

export type HomepageDemoFeedItem =
  | {
      kind: "update";
      minutesAgo: number;
      message: string;
      milestone?: Milestone;
      photo?: HomepageDemoPhotoKey;
    }
  | {
      kind: "encouragement";
      minutesAgo: number;
      authorName: string;
      message: string;
    };

/**
 * A ~two-day labour story, newest events closest to "now". Timestamps are
 * offsets so each production refresh looks recent.
 */
export const HOMEPAGE_DEMO_FEED: HomepageDemoFeedItem[] = [
  {
    kind: "update",
    minutesAgo: 48 * 60,
    message:
      "40 weeks and this bump is out of control. Restless night — wondering if tonight's the night.",
    photo: "bump",
  },
  {
    kind: "encouragement",
    minutesAgo: 46 * 60,
    authorName: "Grandma Helen",
    message: "Rest up, sweetheart. Can't wait to meet her! 💕",
  },
  {
    kind: "encouragement",
    minutesAgo: 44 * 60,
    authorName: "Sam",
    message: "The nesting is REAL. Sending you the biggest hug. You've got this.",
  },
  {
    kind: "update",
    minutesAgo: 41 * 60,
    milestone: "labor_started",
    message:
      "Okay this is it!! Contractions every 7 minutes. Timing them on the app and trying to stay calm.",
  },
  {
    kind: "encouragement",
    minutesAgo: 40 * 60,
    authorName: "Maya",
    message: "YOU'VE GOT THIS. Phone is glued to my hand. Love you both.",
  },
  {
    kind: "encouragement",
    minutesAgo: 38 * 60,
    authorName: "Uncle Mateo",
    message: "One wave at a time. So proud of you two.",
  },
  {
    kind: "update",
    minutesAgo: 33 * 60,
    message:
      "Contractions are 4–5 minutes apart and a lot stronger. Bag is by the door. Midwife said we can stay home a little longer.",
    photo: "bag",
  },
  {
    kind: "encouragement",
    minutesAgo: 32 * 60,
    authorName: "Jess",
    message: "Thinking of you!! Keep us posted when you can.",
  },
  {
    kind: "update",
    minutesAgo: 26 * 60,
    message:
      "Long night on the ball. Slow, wave-by-wave labour. Thank you for every message — they really help 💛",
    photo: "labor",
  },
  {
    kind: "encouragement",
    minutesAgo: 25 * 60,
    authorName: "Priya",
    message: "You're doing amazing. We've got the dog if you need anything at all!",
  },
  {
    kind: "update",
    minutesAgo: 20 * 60,
    milestone: "gone_to_hospital",
    message: "Heading in! Contractions are intense and close together. Time to meet our girl.",
  },
  {
    kind: "encouragement",
    minutesAgo: 19 * 60,
    authorName: "Grandma Helen",
    message: "Drive safe. I'll be thinking of you the whole way.",
  },
  {
    kind: "encouragement",
    minutesAgo: 18 * 60,
    authorName: "Aunt Leah",
    message: "Yessss go go go!! Love you.",
  },
  {
    kind: "update",
    minutesAgo: 14 * 60,
    message:
      "Checked in and settled. Lights are low, epidural is working. Waiting for her to make her way. Everyone here has been so kind.",
    photo: "hospital",
  },
  {
    kind: "encouragement",
    minutesAgo: 13 * 60,
    authorName: "Sam",
    message: "The calm in the middle. So proud of you. Breathe.",
  },
  {
    kind: "update",
    minutesAgo: 8 * 60,
    message: "8cm!! Getting close. Partner has been a rock. We can feel her coming.",
  },
  {
    kind: "encouragement",
    minutesAgo: 7 * 60,
    authorName: "Maya",
    message: "AAAAAAAA I'm pacing. Come on Juniper, you've got this!!",
  },
  {
    kind: "encouragement",
    minutesAgo: 4 * 60,
    authorName: "Uncle Mateo",
    message: "Almost there. Sending all the strength.",
  },
  {
    kind: "update",
    minutesAgo: 150,
    milestone: "born",
    message:
      "She's here!! Juniper Mae, 7lb 2oz, born after a long beautiful labour. We are smitten. Thank you for walking these two days with us.",
    photo: "born",
  },
  {
    kind: "encouragement",
    minutesAgo: 120,
    authorName: "Grandma Helen",
    message: "WELCOME JUNIPER MAE 💕💕💕 Grandma is crying happy tears.",
  },
  {
    kind: "encouragement",
    minutesAgo: 90,
    authorName: "Sam",
    message: "JUNIPER!!!! She's here she's here she's here. Look at that little face.",
  },
  {
    kind: "encouragement",
    minutesAgo: 45,
    authorName: "Priya",
    message: "Congratulations you two. What a journey. Rest now — we'll bring food.",
  },
  {
    kind: "encouragement",
    minutesAgo: 20,
    authorName: "Jess",
    message: "Welcome to the world, Juniper. What wonderful news.",
  },
];
