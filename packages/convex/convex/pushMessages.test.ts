import { expect, test } from "vitest";
import { getOwnerPushMessage, getPushMessage, truncateOwnerPushBody } from "../src/pushMessages";
import type { OwnerMessagePushEvent } from "../src/pushMessages";
import { SUPPORTED_LOCALES } from "../src/i18n";
import type { SupportedLocale } from "../src/i18n";
import type { NotifiableStatus } from "../src/types";

function msg(opts: { locale: SupportedLocale; status: NotifiableStatus; babyName: string }) {
  return getPushMessage(opts);
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
    msg({ locale: "en-GB", status: "update_posted", babyName: "Nova" }),
  ]).toEqual([
    { title: "Nova: Labour's started!", body: "It's happening! Tap for the latest." },
    { title: "Nova is heading to hospital!", body: "They're heading in. Tap for the latest." },
    { title: "Nova is here! 🎉", body: "The wait is over. Tap for the happy news." },
    { title: "Nova: New photo! 📸", body: "Tap to have a look!" },
    { title: "Nova: New update", body: "Tap for the latest." },
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

test("owner message push copy names the visitor and truncates long notes", () => {
  expect(
    getOwnerPushMessage({
      locale: "en-GB",
      event: "created",
      babyName: "Nova",
      authorName: "Grandma",
      message: "Can't wait to meet you!",
    }),
  ).toEqual({
    title: "New message for Nova",
    body: "Grandma: Can't wait to meet you!",
  });
  expect(
    getOwnerPushMessage({
      locale: "en-GB",
      event: "updated",
      babyName: "Nova",
      authorName: "Grandma",
      message: "Fixed the typo",
    }),
  ).toEqual({
    title: "Grandma updated their message on Nova's page",
    body: "Fixed the typo",
  });
  expect(
    getOwnerPushMessage({
      locale: "sv",
      event: "updated",
      babyName: "Nova",
      authorName: "Mormor",
      message: "Korrigerade stavningen",
    }),
  ).toEqual({
    title: "Mormor uppdaterade sin hälsning på Novas sida",
    body: "Korrigerade stavningen",
  });
  expect(truncateOwnerPushBody("short")).toBe("short");
  expect(truncateOwnerPushBody("x".repeat(181)).length).toBe(180);
  expect(truncateOwnerPushBody("x".repeat(181)).endsWith("…")).toBe(true);

  const events = ["created", "updated"] as const satisfies OwnerMessagePushEvent[];
  for (const locale of SUPPORTED_LOCALES) {
    for (const event of events) {
      const copy = getOwnerPushMessage({
        locale,
        event,
        babyName: "Nova",
        authorName: "Ada",
        message: "Hi from the waiting room",
      });
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
    }
  }
});
