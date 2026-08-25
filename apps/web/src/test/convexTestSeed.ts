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
