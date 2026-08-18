import { expect, test } from "vitest";
import { getPushMessage } from "../src/pushMessages";
import type { SupportedLocale } from "../src/i18n";
import type { BirthJourney, NotifiableStatus } from "../src/types";

function msg(opts: {
  locale: SupportedLocale;
  status: NotifiableStatus;
  babyName: string;
  birthJourney?: BirthJourney;
}) {
  return getPushMessage({ ...opts, birthJourney: opts.birthJourney ?? "labour" });
}

test("push copy follows the baby's locale and dialect", () => {
  expect(msg({ locale: "sv", status: "labor_started", babyName: "Nova" })).toEqual({
    title: "Nova: Förlossningen är igång!",
    body: "Värkarna har börjat. Kika in för senaste nytt!",
  });
  expect([
    msg({ locale: "en-GB", status: "labor_started", babyName: "Nova" }),
    msg({ locale: "en-GB", status: "gone_to_hospital", babyName: "Nova" }),
    msg({ locale: "en-GB", status: "born", babyName: "Nova" }),
    msg({ locale: "en-GB", status: "photo_added", babyName: "Nova" }),
  ]).toEqual([
    { title: "Nova: Labour's started!", body: "It's happening! Tap for the latest." },
    { title: "Nova is heading to hospital!", body: "They're heading in. Tap for the latest." },
    { title: "Nova is here! 🎉", body: "The wait is over. Tap for the happy news." },
    { title: "Nova: New photo! 📸", body: "Tap to have a look!" },
  ]);
  expect([
    msg({ locale: "en-US", status: "labor_started", babyName: "Nova" }),
    msg({ locale: "en-US", status: "gone_to_hospital", babyName: "Nova" }),
    msg({ locale: "en-US", status: "born", babyName: "Nova" }),
    msg({ locale: "en-US", status: "photo_added", babyName: "Nova" }),
  ]).toEqual([
    { title: "Nova: Labor's started!", body: "It's happening! Tap for the latest." },
    {
      title: "Nova is heading to the hospital!",
      body: "They're heading in. Tap for the latest.",
    },
    { title: "Nova is here! 🎉", body: "The wait is over. Tap for the happy news." },
    { title: "Nova: New photo! 📸", body: "Tap to take a look!" },
  ]);
  expect(msg({ locale: "es", status: "born", babyName: "Nova" }).title).toBe(
    "¡Nova ya está aquí! 🎉",
  );
  expect([
    msg({ locale: "pt-BR", status: "labor_started", babyName: "Nova" }).title,
    msg({ locale: "pt-BR", status: "gone_to_hospital", babyName: "Nova" }).title,
    msg({ locale: "pt-BR", status: "born", babyName: "Nova" }).title,
    msg({ locale: "pt-BR", status: "photo_added", babyName: "Nova" }).title,
  ]).toEqual([
    "Nova: o trabalho de parto começou!",
    "Nova está a caminho do hospital!",
    "Nova chegou! 🎉",
    "Foto nova de Nova! 📸",
  ]);
});

test("planned C-section hospital notifications announce the big day", () => {
  expect(
    msg({
      locale: "en-GB",
      status: "gone_to_hospital",
      babyName: "Nova",
      birthJourney: "planned_c_section",
    }),
  ).toEqual({
    title: "Nova: The big day is here!",
    body: "They're at hospital for the planned C-section. Tap for the latest.",
  });
});
