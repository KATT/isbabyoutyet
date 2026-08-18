import { expect, test } from "vitest";
import type { BabyWebAppManifestInput } from "@/lib/baby-manifest";
import { babyWebAppManifest } from "@/lib/baby-manifest";

const BABY: BabyWebAppManifestInput = {
  _id: "j57permanentid",
  publicId: "baby-smith",
  name: "Baby Smith",
  resolvedLocale: "en-GB",
  theme: null,
};

test("PWA identity uses the permanent document id, not the shareable publicId", () => {
  const manifest = babyWebAppManifest(BABY);

  expect(manifest.id).toBe(`/baby/${BABY._id}`);
  expect(manifest.id).not.toContain(BABY.publicId);
  expect(manifest.start_url).toBe(`/baby/${BABY.publicId}`);
  expect(manifest.scope).toBe(`/baby/${BABY.publicId}`);
});

test("renaming the baby does not change the installed PWA identity", () => {
  const before = babyWebAppManifest(BABY);
  const after = babyWebAppManifest({ ...BABY, publicId: "ada", name: "Ada" });

  expect(after.id).toBe(before.id);
  expect(after.start_url).toBe("/baby/ada");
  expect(after.scope).toBe("/baby/ada");
  expect(after.name).toBe("Is Ada out yet?");
});

test("manifest copy follows the baby's locale", () => {
  const manifest = babyWebAppManifest({ ...BABY, resolvedLocale: "sv" });

  expect(manifest.lang).toBe("sv");
  expect(manifest.name).toBe("Har Baby Smith kommit?");
  expect(manifest.description).toBe("Följ med tills Baby Smith är här!");
});
