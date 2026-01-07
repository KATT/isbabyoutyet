import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("baby.getByPublicId", () => {
  test("returns baby by publicId", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user123" });

    // Create a baby first
    const { publicId } = await asUser.mutation(api.baby.create, {
      name: "Test Baby",
      dueDate: "2026-03-15",
    });

    // Query by publicId (no auth required for public pages)
    const baby = await t.query(api.baby.getByPublicId, { id: publicId });

    expect(baby).not.toBeNull();
    expect(baby?.name).toBe("Test Baby");
    expect(baby?.publicId).toBe("test-baby");
  });

  test("returns baby by Convex ID", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user123" });

    const { babyId } = await asUser.mutation(api.baby.create, {
      name: "Another Baby",
      dueDate: "2026-06-01",
    });

    const baby = await t.query(api.baby.getByPublicId, { id: babyId });

    expect(baby).not.toBeNull();
    expect(baby?.name).toBe("Another Baby");
  });

  test("returns null for non-existent publicId", async () => {
    const t = convexTest(schema);

    const baby = await t.query(api.baby.getByPublicId, { id: "non-existent" });

    expect(baby).toBeNull();
  });

  test("returns baby via historical publicId after rename", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user123" });

    // Create baby with original name
    const { babyId, publicId: originalPublicId } = await asUser.mutation(api.baby.create, {
      name: "Original Name",
      dueDate: "2026-03-15",
    });

    // Rename baby (which creates history entry)
    await asUser.mutation(api.baby.update, {
      babyId,
      name: "New Name",
    });

    // Should still find via old publicId
    const baby = await t.query(api.baby.getByPublicId, { id: originalPublicId });

    expect(baby).not.toBeNull();
    expect(baby?.name).toBe("New Name");
  });
});

describe("baby.create", () => {
  test("generates unique publicId from name", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user123" });

    const result = await asUser.mutation(api.baby.create, {
      name: "Test Baby",
      dueDate: "2026-03-15",
    });

    expect(result.publicId).toBe("test-baby");
  });

  test("generates numbered publicId for duplicate names", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user123" });

    // Create first baby
    const first = await asUser.mutation(api.baby.create, {
      name: "Duplicate Name",
      dueDate: "2026-03-15",
    });
    expect(first.publicId).toBe("duplicate-name");

    // Create second baby with same name
    const second = await asUser.mutation(api.baby.create, {
      name: "Duplicate Name",
      dueDate: "2026-04-15",
    });
    expect(second.publicId).toBe("duplicate-name-1");
  });

  test("throws when not authenticated", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.baby.create, {
        name: "Test Baby",
        dueDate: "2026-03-15",
      }),
    ).rejects.toThrow("Not authenticated");
  });
});

describe("baby.listByUser", () => {
  test("returns empty array when not authenticated", async () => {
    const t = convexTest(schema);

    const babies = await t.query(api.baby.listByUser, {});

    expect(babies).toEqual([]);
  });

  test("returns only babies belonging to the authenticated user", async () => {
    const t = convexTest(schema);
    const user1 = t.withIdentity({ subject: "user1" });
    const user2 = t.withIdentity({ subject: "user2" });

    // User 1 creates a baby
    await user1.mutation(api.baby.create, {
      name: "User1 Baby",
      dueDate: "2026-03-15",
    });

    // User 2 creates a baby
    await user2.mutation(api.baby.create, {
      name: "User2 Baby",
      dueDate: "2026-04-15",
    });

    // User 1 should only see their baby
    const user1Babies = await user1.query(api.baby.listByUser, {});
    expect(user1Babies).toHaveLength(1);
    expect(user1Babies[0].name).toBe("User1 Baby");

    // User 2 should only see their baby
    const user2Babies = await user2.query(api.baby.listByUser, {});
    expect(user2Babies).toHaveLength(1);
    expect(user2Babies[0].name).toBe("User2 Baby");
  });
});

describe("baby.update", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user123" });

    const { babyId } = await asUser.mutation(api.baby.create, {
      name: "Test Baby",
      dueDate: "2026-03-15",
    });

    await expect(
      t.mutation(api.baby.update, {
        babyId,
        name: "New Name",
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("throws when updating another user's baby", async () => {
    const t = convexTest(schema);
    const user1 = t.withIdentity({ subject: "user1" });
    const user2 = t.withIdentity({ subject: "user2" });

    const { babyId } = await user1.mutation(api.baby.create, {
      name: "User1 Baby",
      dueDate: "2026-03-15",
    });

    await expect(
      user2.mutation(api.baby.update, {
        babyId,
        name: "Hacked Name",
      }),
    ).rejects.toThrow("Not authorized");
  });

  test("updates baby name and creates history entry", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user123" });

    const { babyId, publicId: originalPublicId } = await asUser.mutation(api.baby.create, {
      name: "Original",
      dueDate: "2026-03-15",
    });

    await asUser.mutation(api.baby.update, {
      babyId,
      name: "Updated",
    });

    const baby = await t.query(api.baby.getByPublicId, { id: babyId });
    expect(baby?.name).toBe("Updated");
    expect(baby?.publicId).toBe("updated");

    // Original publicId should still work via history
    const viaHistory = await t.query(api.baby.getByPublicId, { id: originalPublicId });
    expect(viaHistory?.name).toBe("Updated");
  });
});
