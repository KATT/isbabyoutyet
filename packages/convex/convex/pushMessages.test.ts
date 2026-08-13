import { expect, test } from "vitest";
import { getPushMessage } from "../src/pushMessages";

test("push copy follows the baby's locale and dialect", () => {
  expect(getPushMessage("sv", "labor_started", "Nova")).toEqual({
    title: "Nova: Förlossningen är igång!",
    body: "Värkarna har börjat. Kika in för senaste nytt!",
  });
  expect([
    getPushMessage("en-GB", "labor_started", "Nova"),
    getPushMessage("en-GB", "gone_to_hospital", "Nova"),
    getPushMessage("en-GB", "born", "Nova"),
    getPushMessage("en-GB", "photo_added", "Nova"),
  ]).toEqual([
    { title: "Nova: Labour's started!", body: "It's happening! Tap for the latest." },
    { title: "Nova is heading to hospital!", body: "They're heading in. Tap for the latest." },
    { title: "Nova is here! 🎉", body: "The wait is over. Tap for the happy news." },
    { title: "Nova: New photo! 📸", body: "Tap to have a look!" },
  ]);
  expect([
    getPushMessage("en-US", "labor_started", "Nova"),
    getPushMessage("en-US", "gone_to_hospital", "Nova"),
    getPushMessage("en-US", "born", "Nova"),
    getPushMessage("en-US", "photo_added", "Nova"),
  ]).toEqual([
    { title: "Nova: Labor's started!", body: "It's happening! Tap for the latest." },
    {
      title: "Nova is heading to the hospital!",
      body: "They're heading in. Tap for the latest.",
    },
    { title: "Nova is here! 🎉", body: "The wait is over. Tap for the happy news." },
    { title: "Nova: New photo! 📸", body: "Tap to take a look!" },
  ]);
  expect(getPushMessage("es", "born", "Nova").title).toBe("¡Nova ya está aquí! 🎉");
  expect([
    getPushMessage("pt-BR", "labor_started", "Nova").title,
    getPushMessage("pt-BR", "gone_to_hospital", "Nova").title,
    getPushMessage("pt-BR", "born", "Nova").title,
    getPushMessage("pt-BR", "photo_added", "Nova").title,
  ]).toEqual([
    "Nova: o trabalho de parto começou!",
    "Nova está a caminho do hospital!",
    "Nova chegou! 🎉",
    "Foto nova de Nova! 📸",
  ]);
});
