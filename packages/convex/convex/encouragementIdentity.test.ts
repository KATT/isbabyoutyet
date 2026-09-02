import { expect, test } from "vitest";
import { encouragementIsMine, storedEncouragementUserId } from "./encouragementIdentity";

test("storedEncouragementUserId is null for guests", () => {
  expect(storedEncouragementUserId(null)).toBeNull();
  expect(storedEncouragementUserId({ type: "visitor", visitorId: "v1" })).toBeNull();
  expect(storedEncouragementUserId({ type: "user", userId: "alice", visitorId: "v1" })).toBe(
    "alice",
  );
});

test("a signed-in author matches by user id even on a new visitor id", () => {
  expect(
    encouragementIsMine(
      { userId: "alice", visitorId: "old-browser" },
      { type: "user", userId: "alice", visitorId: "new-browser" },
    ),
  ).toBe(true);
});

test("a signed-in author still matches unclaimed guest posts from this browser", () => {
  expect(
    encouragementIsMine(
      { userId: null, visitorId: "same-browser" },
      { type: "user", userId: "alice", visitorId: "same-browser" },
    ),
  ).toBe(true);
});

test("a guest only matches their visitor id", () => {
  expect(
    encouragementIsMine({ userId: null, visitorId: "v1" }, { type: "visitor", visitorId: "v1" }),
  ).toBe(true);
  expect(
    encouragementIsMine({ userId: "alice", visitorId: "v1" }, { type: "visitor", visitorId: "v2" }),
  ).toBe(false);
  expect(encouragementIsMine({ userId: "alice", visitorId: "v1" }, null)).toBe(false);
});
