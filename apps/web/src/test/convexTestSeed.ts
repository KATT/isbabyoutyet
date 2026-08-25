import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { createAuth } from "@workspace/convex/convex/auth";
import type { ConvexTestHarness } from "@/test/convexTestHarness";

/** Creates a baby owned by the harness identity (must already be set). */
export async function seedOwnedBaby(
  harness: ConvexTestHarness,
  opts: {
    name: string;
    dueDate: string | null;
  },
) {
  const created = await harness.client.mutation(api.baby.create, {
    name: opts.name,
    dueDate: opts.dueDate,
  });
  return {
    babyId: created.babyId as Id<"baby">,
    publicId: created.publicId,
  };
}

/** Signs up a Better Auth user through the in-memory Convex backend. */
export async function signUpTestUser(
  harness: ConvexTestHarness,
  opts: {
    email: string;
    password: string;
    name: string;
  },
) {
  return await harness.t.run(async (ctx) => {
    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: {
        email: opts.email,
        password: opts.password,
        name: opts.name,
      },
    });
    return result.user.id;
  });
}

export async function storeTestBlob(harness: ConvexTestHarness) {
  return await harness.t.run(async (ctx) => {
    const buffer = new ArrayBuffer(8);
    new Uint8Array(buffer).set([137, 80, 78, 71, 13, 10, 26, 10]);
    return await ctx.storage.store(new Blob([buffer], { type: "image/png" }));
  });
}

/** Creates a baby with a page photo stored in the in-memory Convex backend. */
export async function seedBabyWithPhoto(
  harness: ConvexTestHarness,
  opts: {
    name: string;
    dueDate: string | null;
  },
) {
  const baby = await seedOwnedBaby(harness, opts);
  const photoId = await storeTestBlob(harness);
  await harness.client.mutation(api.baby.updatePhoto, {
    babyId: baby.babyId,
    photoId,
  });
  return {
    ...baby,
    photoId,
  };
}

/** Posts a timeline update with a photo and returns the update id. */
export async function seedTimelineUpdateWithPhoto(
  harness: ConvexTestHarness,
  opts: {
    babyId: Id<"baby">;
    message: string;
  },
) {
  const photoId = await storeTestBlob(harness);
  const updateId = await harness.client.mutation(api.updates.post, {
    babyId: opts.babyId,
    message: opts.message,
    photoId,
  });
  return { updateId, photoId };
}
