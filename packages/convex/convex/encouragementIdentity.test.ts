import { expect, test } from "vitest";
import {
  encouragementHasUserId,
  encouragementIsMine,
  storedEncouragementAuthor,
  storedEncouragementAuthorFromCaller,
  storedEncouragementUserId,
} from "./encouragementIdentity";

test("storedEncouragementUserId is null for guests", () => {
  expect(storedEncouragementUserId(null)).toBeNull();
  expect(storedEncouragementUserId({ type: "visitor", visitorId: "v1" })).toBeNull();
  expect(storedEncouragementUserId({ type: "user", userId: "alice", visitorId: "v1" })).toBe(
    "alice",
  );
});

test("storedEncouragementAuthor prefers the union field over legacy columns", () => {
  expect(
    storedEncouragementAuthor({
      author: { type: "user", userId: "alice", visitorId: "v1" },
      userId: "ignored",
      visitorId: "v1",
    }),
  ).toEqual({ type: "user", userId: "alice", visitorId: "v1" });
  expect(
    storedEncouragementAuthor({
      author: undefined,
      userId: "alice",
      visitorId: "v1",
    }),
  ).toEqual({ type: "user", userId: "alice", visitorId: "v1" });
  expect(
    storedEncouragementAuthor({
      author: undefined,
      userId: null,
      visitorId: "v1",
    }),
  ).toEqual({ type: "visitor", visitorId: "v1" });
});

test("storedEncouragementAuthorFromCaller always stores the browser visitor id", () => {
  expect(
    storedEncouragementAuthorFromCaller(
      { type: "user", userId: "alice", visitorId: null },
      "browser-1",
    ),
  ).toEqual({ type: "user", userId: "alice", visitorId: "browser-1" });
  expect(storedEncouragementAuthorFromCaller({ type: "visitor", visitorId: "v1" }, "v1")).toEqual({
    type: "visitor",
    visitorId: "v1",
  });
  expect(storedEncouragementAuthorFromCaller(null, "v1")).toEqual({
    type: "visitor",
    visitorId: "v1",
  });
});

test("encouragementHasUserId reads the union or the legacy userId", () => {
  expect(
    encouragementHasUserId({
      author: { type: "user", userId: "alice", visitorId: "v1" },
      userId: null,
      visitorId: "v1",
    }),
  ).toBe(true);
  expect(
    encouragementHasUserId({
      author: undefined,
      userId: "alice",
      visitorId: "v1",
    }),
  ).toBe(true);
  expect(
    encouragementHasUserId({
      author: { type: "visitor", visitorId: "v1" },
      userId: null,
      visitorId: "v1",
    }),
  ).toBe(false);
});

test("a signed-in author matches by user id even on a new visitor id", () => {
  expect(
    encouragementIsMine(
      {
        author: { type: "user", userId: "alice", visitorId: "old-browser" },
        userId: "alice",
        visitorId: "old-browser",
      },
      { type: "user", userId: "alice", visitorId: "new-browser" },
    ),
  ).toBe(true);
});

test("a signed-in author still matches unclaimed guest posts from this browser", () => {
  expect(
    encouragementIsMine(
      {
        author: { type: "visitor", visitorId: "same-browser" },
        userId: null,
        visitorId: "same-browser",
      },
      { type: "user", userId: "alice", visitorId: "same-browser" },
    ),
  ).toBe(true);
});

test("legacy rows without author still match by userId or visitorId", () => {
  expect(
    encouragementIsMine(
      { author: undefined, userId: "alice", visitorId: "old-browser" },
      { type: "user", userId: "alice", visitorId: "new-browser" },
    ),
  ).toBe(true);
  expect(
    encouragementIsMine(
      { author: undefined, userId: null, visitorId: "v1" },
      { type: "visitor", visitorId: "v1" },
    ),
  ).toBe(true);
});

test("a guest only matches their visitor id", () => {
  expect(
    encouragementIsMine(
      { author: undefined, userId: null, visitorId: "v1" },
      { type: "visitor", visitorId: "v1" },
    ),
  ).toBe(true);
  expect(
    encouragementIsMine(
      {
        author: { type: "user", userId: "alice", visitorId: "v1" },
        userId: "alice",
        visitorId: "v1",
      },
      { type: "visitor", visitorId: "v2" },
    ),
  ).toBe(false);
  expect(
    encouragementIsMine(
      {
        author: { type: "user", userId: "alice", visitorId: "v1" },
        userId: "alice",
        visitorId: "v1",
      },
      null,
    ),
  ).toBe(false);
});
