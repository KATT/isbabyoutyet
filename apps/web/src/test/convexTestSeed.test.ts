import { expect, test } from "vitest";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { patchOwnedBaby, seedOwnedBaby } from "@/test/convexTestSeed";

test("patchOwnedBaby throws when the baby row is gone", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  await harness.t.run(async (ctx) => {
    await ctx.db.delete(baby.babyId);
  });

  await expect(
    patchOwnedBaby(harness, {
      id: baby.babyId,
      data: { name: "Gone" },
    }),
  ).rejects.toThrow("Baby not found");
});
