import { render } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { convexTest } from "convex-test";
import type { FunctionReturnType } from "convex/server";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { StatusDisplay } from "@/components/baby/status-display";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import schema from "@workspace/convex/convex/schema";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { modules, registerComponents } from "@workspace/convex/convex/test.setup";
import type { BabyData } from "@workspace/convex/src/types";
import {
  FORBIDDEN,
  DEFAULT_MILESTONE_VISIBILITY,
  getCurrentStatus,
} from "@workspace/convex/src/types";
import { LocaleProvider } from "@/lib/i18n";

const getToken = vi.hoisted(() => vi.fn<() => Promise<string | null>>());

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (fn: unknown) => fn }),
}));

vi.mock("@/lib/auth-server", () => ({
  authServer: { getToken },
}));

const routeModule = await import("@/routes/baby/$publicId/route");
const { docToBabyData, managerDocToBabyData } = routeModule;

function useFakeTimersResource(now: Date) {
  vi.useFakeTimers({ now });
  return makeResource({}, () => {
    vi.useRealTimers();
  });
}

type PublicBaby = NonNullable<FunctionReturnType<typeof api.baby.getByPublicId>>;

/**
 * Happy-path stand-in for the baby detail page: heading + status from
 * data loaded via convex-test (in-memory local Convex).
 */
function BabyDetailPage(props: { baby: PublicBaby }) {
  const baby = docToBabyData(props.baby);
  const currentStatus = getCurrentStatus(baby);

  return (
    <div>
      <h1>Is {baby.name} out yet?</h1>
      <StatusDisplay
        baby={baby}
        currentStatus={currentStatus}
        photoUrl={null}
        thumbnailUrl={null}
        blurDataUrl={null}
        latestUpdate={null}
      />
    </div>
  );
}

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("renders a baby detail page from local convex-test data", async () => {
  // Freeze "now" so StatusDisplay's until-due / overdue copy stays deterministic
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  const t = convexTest(schema, modules);
  await registerComponents(t);

  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby Smith",
    dueDate: "2026-09-01",
  });

  const baby = await t.query(api.baby.getByPublicId, { id: created.publicId });
  expect(baby).toMatchObject({
    name: "Baby Smith",
    publicId: "baby-smith",
    dueDate: "2026-09-01",
  });
  if (!baby) {
    throw new Error("expected baby from getByPublicId");
  }
  expect(baby).not.toHaveProperty("publicDueDateText");
  const managerDoc = await asAlice.query(api.baby.getManagerBaby, { babyId: created.babyId });
  if (managerDoc === FORBIDDEN) {
    throw new Error("expected manager baby");
  }
  expect(managerDocToBabyData(managerDoc)).toMatchObject({
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
  });
  expect(
    docToBabyData({
      ...baby,
      theme: "baby-blue",
      locale: "sv",
      laborStarted: "2026-08-10T08:00:00.000Z",
      wentToHospital: "2026-08-10T12:00:00.000Z",
      babyBorn: "2026-08-11T03:00:00.000Z",
      photoId: "photo-id" as Id<"_storage">,
    }),
  ).toMatchObject({
    theme: "baby-blue",
    locale: "sv",
    laborStarted: "2026-08-10T08:00:00.000Z",
    wentToHospital: "2026-08-10T12:00:00.000Z",
    babyBorn: "2026-08-11T03:00:00.000Z",
    photoId: "photo-id",
  });
  expect(
    managerDocToBabyData({
      ...managerDoc,
      theme: "baby-blue",
      locale: "sv",
      publicDueDateText: "Retained message",
      photoId: "photo-id" as Id<"_storage">,
    }),
  ).toMatchObject({
    theme: "baby-blue",
    locale: "sv",
    publicDueDateText: "Retained message",
    photoId: "photo-id",
  });

  await using view = renderResource(<BabyDetailPage baby={baby} />);

  expect(view.getByRole("heading", { name: "Is Baby Smith out yet?" })).toBeTruthy();
  expect(view.getByText("Not yet")).toBeTruthy();
  expect(view.getByText("Baby is still on the way")).toBeTruthy();
  expect(view.getByText("21 days until due date")).toBeTruthy();
  expect(view.getByText("Due date: 1 September 2026")).toBeTruthy();
});

test("renders optional public due date text without exposing the exact day", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const created = await t.withIdentity({ subject: "alice" }).mutation(api.baby.create, {
    name: "Baby Smith",
    dueDate: null,
    dueDateDisplayMode: "message",
    publicDueDateText: "Any day now",
  });
  const baby = await t.query(api.baby.getByPublicId, { id: created.publicId });
  if (!baby) {
    throw new Error("expected baby from getByPublicId");
  }
  expect(baby).not.toHaveProperty("dueDate");
  const managerDoc = await t
    .withIdentity({ subject: "alice" })
    .query(api.baby.getManagerBaby, { babyId: created.babyId });
  if (managerDoc === FORBIDDEN) {
    throw new Error("expected manager baby");
  }
  expect(managerDocToBabyData(managerDoc)).toMatchObject({
    dueDate: null,
    dueDateDisplayMode: "message",
    publicDueDateText: "Any day now",
  });

  await using view = renderResource(<BabyDetailPage baby={baby} />);
  expect(view.getByText("Any day now")).toBeTruthy();
  expect(view.queryByText(/until due date/)).toBeNull();
  expect(view.queryByText(/19 September/)).toBeNull();
});

test("hides the due date box when message mode has no public text", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const created = await t.withIdentity({ subject: "alice" }).mutation(api.baby.create, {
    name: "Baby Smith",
    dueDate: "2026-09-01",
    dueDateDisplayMode: "message",
    publicDueDateText: null,
  });
  const baby = await t.query(api.baby.getByPublicId, { id: created.publicId });
  if (!baby) {
    throw new Error("expected baby from getByPublicId");
  }
  expect(baby).toMatchObject({ dueDateDisplayMode: "message" });
  if ("publicDueDateText" in baby) {
    expect(baby.publicDueDateText).toBeUndefined();
  }
  expect(baby).not.toHaveProperty("dueDate");

  await using view = renderResource(<BabyDetailPage baby={baby} />);
  expect(view.getByText("Not yet")).toBeTruthy();
  expect(view.queryByText(/until due date/)).toBeNull();
  expect(view.queryByText(/Due date:/)).toBeNull();
});

test("renders the public baby status in the baby's Swedish override", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));
  const baby: BabyData = {
    name: "Nova",
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
  };

  await using view = renderResource(
    <LocaleProvider locale="sv">
      <StatusDisplay
        baby={baby}
        currentStatus={getCurrentStatus(baby)}
        photoUrl={null}
        thumbnailUrl={null}
        blurDataUrl={null}
        latestUpdate={null}
      />
    </LocaleProvider>,
  );

  expect(view.getByText("Inte än")).toBeTruthy();
  expect(view.getByText("Bäbisen är fortfarande på väg")).toBeTruthy();
  expect(view.getByText("Beräknat datum: 1 september 2026")).toBeTruthy();
});

test("renders the public baby status in Brazilian Portuguese", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));
  const baby: BabyData = {
    name: "Nova",
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
  };

  await using view = renderResource(
    <LocaleProvider locale="pt-BR">
      <StatusDisplay
        baby={baby}
        currentStatus={getCurrentStatus(baby)}
        photoUrl={null}
        thumbnailUrl={null}
        blurDataUrl={null}
        latestUpdate={null}
      />
    </LocaleProvider>,
  );

  expect(view.getByText("Ainda não")).toBeTruthy();
  expect(view.getByText("O bebê ainda está a caminho")).toBeTruthy();
  expect(view.getByText("Data prevista: 1 de setembro de 2026")).toBeTruthy();
});

// --- Route loader: awaited handles plus the owner/visitor branching ---

const BABY_DOC = { _id: "baby-1", publicId: "baby-smith", resolvedLocale: "en-GB" };
const EMPTY_PAGE = { page: [], isDone: true, continueCursor: "" };

function makeLoaderQueryClient(handlers: Record<string, unknown>) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: (ctx) => {
          const name = String(ctx.queryKey[1]);
          if (name in handlers) {
            return Promise.resolve(handlers[name]);
          }
          return Promise.resolve(null);
        },
      },
    },
  });
}

type LoaderOptions = {
  token: string | null | undefined;
  locale: string | undefined;
  convexClient:
    | {
        setAuth: ReturnType<typeof vi.fn>;
        mutation: ReturnType<typeof vi.fn>;
      }
    | undefined;
};

async function runBabyLoader(
  handlers: Record<string, unknown>,
  options: LoaderOptions | undefined = undefined,
) {
  const setAuth = options?.convexClient?.setAuth ?? vi.fn();
  const mutation =
    options?.convexClient?.mutation ??
    vi.fn<() => Promise<unknown>>(() => Promise.resolve({ locale: "en-GB" }));
  // The infinite timeline query fetches through the registered Convex client.
  const { registerConvexInfiniteQueryClient } = await import("@workspace/convex-prefetch");
  registerConvexInfiniteQueryClient({
    convexClient: { query: () => Promise.resolve(EMPTY_PAGE) },
    serverHttpClient: undefined,
  } as never);
  const loader = routeModule.Route.options.loader as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexClient: { setAuth: typeof setAuth; mutation: typeof mutation };
      token: string | null;
      locale: string;
    };
    params: { publicId: string };
  }) => Promise<Record<string, unknown>>;
  return await loader({
    context: {
      queryClient: makeLoaderQueryClient(handlers),
      convexClient: { setAuth, mutation },
      token: options?.token ?? null,
      locale: options?.locale ?? "en-GB",
    },
    params: { publicId: "baby-smith" },
  });
}

test("loader queries the same set for visitors; gated queries come back forbidden", async () => {
  const result = await runBabyLoader({
    "baby:getByPublicId": BABY_DOC,
    "coParents:myAccess": { canManage: false, isOwner: false },
    "baby:getManagerBaby": "forbidden",
    "timeline:listByBaby": EMPTY_PAGE,
    "baby:getScheduledNotifications": "forbidden",
    "pushSubscriptions:getSubscriptionCount": "forbidden",
  });

  expect(result.baby).toMatchObject({ initialData: BABY_DOC });
  expect(result.myAccess).toMatchObject({ initialData: { canManage: false } });
  expect(result.managerBaby).toMatchObject({ initialData: "forbidden" });
  expect(result.timeline).toMatchObject({ input: { babyId: "baby-1" }, numItems: 20 });
  expect(result.scheduledNotifications).toMatchObject({ initialData: "forbidden" });
  expect(result.subscriptionCount).toMatchObject({ initialData: "forbidden" });
});

test("loader gives managers the same handles with real data", async () => {
  const result = await runBabyLoader({
    "baby:getByPublicId": BABY_DOC,
    "coParents:myAccess": { canManage: true, isOwner: true },
    "baby:getManagerBaby": { ...BABY_DOC, birthJourney: "labor" },
    "timeline:listByBaby": EMPTY_PAGE,
    "baby:getScheduledNotifications": [],
    "pushSubscriptions:getSubscriptionCount": 2,
  });

  expect(result.scheduledNotifications).toMatchObject({
    input: { babyId: "baby-1" },
    initialData: [],
  });
  expect(result.subscriptionCount).toMatchObject({
    input: { babyId: "baby-1" },
    initialData: 2,
  });
  expect(result.onboarding).toMatchObject({ input: {} });
  expect(result.managerBaby).toMatchObject({
    initialData: { birthJourney: "labor" },
  });
});

test("loader 404s unknown babies", async () => {
  const pending = runBabyLoader({ "baby:getByPublicId": null });

  await expect(pending).rejects.toMatchObject({ isNotFound: true });
});

test("loader authenticates signed-in visitors before prefetching manager data", async () => {
  getToken.mockReset();
  getToken.mockResolvedValueOnce("session-token");
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const mutation = vi.fn<() => Promise<unknown>>(() =>
    Promise.resolve({ locale: "en-GB", isAdmin: false }),
  );
  const sharedHandlers = {
    "baby:getByPublicId": BABY_DOC,
    "profile:get": { locale: "en-GB", isAdmin: false },
    "coParents:myAccess": { canManage: true, isOwner: true },
    "baby:getManagerBaby": BABY_DOC,
    "timeline:listByBaby": EMPTY_PAGE,
    "baby:getScheduledNotifications": [],
    "pushSubscriptions:getSubscriptionCount": 0,
  };

  await runBabyLoader(sharedHandlers, {
    token: undefined,
    locale: undefined,
    convexClient: { setAuth, mutation },
  });

  expect(getToken).toHaveBeenCalledTimes(1);
  expect(setAuth).toHaveBeenCalledTimes(1);
  expect(mutation).toHaveBeenCalledWith(api.profile.ensure, { browserLocale: "en-GB" });
});

test("loader reuses a context token without calling getAuthToken", async () => {
  getToken.mockReset();
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const mutation = vi.fn<() => Promise<unknown>>(() =>
    Promise.resolve({ locale: "sv", isAdmin: false }),
  );

  await runBabyLoader(
    {
      "baby:getByPublicId": BABY_DOC,
      "profile:get": { locale: "sv", isAdmin: false },
      "coParents:myAccess": { canManage: false, isOwner: false },
      "baby:getManagerBaby": "forbidden",
      "timeline:listByBaby": EMPTY_PAGE,
      "baby:getScheduledNotifications": "forbidden",
      "pushSubscriptions:getSubscriptionCount": "forbidden",
    },
    { token: "layout-token", locale: "sv", convexClient: { setAuth, mutation } },
  );

  expect(getToken).not.toHaveBeenCalled();
  expect(setAuth).toHaveBeenCalledTimes(1);
  expect(mutation).toHaveBeenCalledWith(api.profile.ensure, { browserLocale: "sv" });
});

test("docToBabyData coalesces missing public due date text to null", () => {
  expect(
    docToBabyData({
      _id: "baby-1" as Id<"baby">,
      _creationTime: 1,
      name: "Nova",
      dueDateDisplayMode: "message",
      publicDueDateText: undefined,
      theme: "baby-blue",
      locale: "en-GB",
      resolvedLocale: "en-GB",
      laborStarted: null,
      wentToHospital: null,
      babyBorn: null,
      milestoneVisibility: DEFAULT_MILESTONE_VISIBILITY,
      publicId: "nova",
      photoUrl: null,
      thumbnailUrl: null,
      blurDataUrl: null,
    }),
  ).toMatchObject({
    dueDateDisplayMode: "message",
    publicDueDateText: null,
  });
});
