import { expect, test } from "vitest";
import { getPushMessage } from "../src/pushMessages";

test("push copy follows the baby's locale and dialect", () => {
  expect(getPushMessage("sv", "labor_started", "Nova")).toEqual({
    title: "Nova: Förlossningen är igång!",
    body: "Värkarna har börjat. Kika in för senaste nytt!",
  });
  expect(getPushMessage("en-US", "labor_started", "Nova").title).toContain("Labor");
  expect(getPushMessage("en-GB", "labor_started", "Nova").title).toContain("Labour");
  expect(getPushMessage("es", "born", "Nova").title).toBe("¡Nova ya está aquí! 🎉");
  expect([
    getPushMessage("pt-BR", "labor_started", "Nova").title,
    getPushMessage("pt-BR", "gone_to_hospital", "Nova").title,
    getPushMessage("pt-BR", "born", "Nova").title,
    getPushMessage("pt-BR", "photo_added", "Nova").title,
  ]).toEqual([
    "Nova – O trabalho de parto começou!",
    "Nova está a caminho do hospital!",
    "Nova chegou! 🎉",
    "Nova – Foto nova! 📸",
  ]);
});
