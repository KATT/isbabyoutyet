import { render } from "@testing-library/react";
import { convexTest } from "convex-test";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { StatusDisplay } from "@/components/baby/status-display";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Doc } from "@workspace/convex/convex/_generated/dataModel";
import schema from "@workspace/convex/convex/schema";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { modules, registerComponents } from "@workspace/convex/convex/test.setup";
import type { BabyData } from "@workspace/convex/src/types";
import { getCurrentStatus } from "@workspace/convex/src/types";
import { LocaleProvider } from "@/lib/i18n";

function useFakeTimersResource(now: Date) {
  vi.useFakeTimers({ now });
  return makeResource({}, () => {
    vi.useRealTimers();
  });
}

/**
 * Convert Convex Doc to BabyData — mirrors the baby detail route helper.
 */
function docToBabyData(doc: Doc<"baby">): BabyData {
  return {
    name: doc.name,
    dueDate: doc.dueDate,
    theme: doc.theme ?? null,
    laborStarted: doc.laborStarted ?? null,
    wentToHospital: doc.wentToHospital ?? null,
    babyBorn: doc.babyBorn ?? null,
    hospitalMessage: doc.hospitalMessage ?? null,
    babyBornMessage: doc.babyBornMessage ?? null,
    laborStartedMessage: doc.laborStartedMessage ?? null,
    encouragementsDisabled: doc.encouragementsDisabled,
    photoId: doc.photoId ?? null,
  };
}

/**
 * Happy-path stand-in for the baby detail page: heading + status from
 * data loaded via convex-test (in-memory local Convex).
 */
function BabyDetailPage(props: { baby: Doc<"baby"> }) {
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

  await using view = renderResource(<BabyDetailPage baby={baby} />);

  expect(view.getByRole("heading", { name: "Is Baby Smith out yet?" })).toBeTruthy();
  expect(view.getByText("Not yet")).toBeTruthy();
  expect(view.getByText("Baby is still on the way")).toBeTruthy();
  expect(view.getByText("21 days until due date")).toBeTruthy();
  expect(view.getByText("Due date: 1 September 2026")).toBeTruthy();
});

test("renders the public baby status in the baby's Swedish override", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));
  const baby: BabyData = {
    name: "Nova",
    dueDate: "2026-09-01",
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
        latestUpdate={null}
      />
    </LocaleProvider>,
  );

  expect(view.getByText("Ainda não")).toBeTruthy();
  expect(view.getByText("O bebê ainda está a caminho")).toBeTruthy();
  expect(view.getByText("Data prevista: 1 de setembro de 2026")).toBeTruthy();
});
