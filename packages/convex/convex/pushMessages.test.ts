import { expect, test } from "vitest";
import { getPushMessage } from "../src/pushMessages";

test("push copy follows the baby's locale and dialect", () => {
  expect(getPushMessage("sv", "labor_started", "Nova")).toEqual({
    title: "Nova – Förlossningen har börjat!",
    body: "Förlossningen har börjat. Se de senaste uppdateringarna!",
  });
  expect(getPushMessage("en-US", "labor_started", "Nova").title).toContain("Labor");
  expect(getPushMessage("en-GB", "labor_started", "Nova").title).toContain("Labour");
  expect(getPushMessage("es", "born", "Nova").title).toBe("¡Nova ya está aquí! 🎉");
});
