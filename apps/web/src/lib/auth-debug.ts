/* oxlint-disable no-console, anti-slop/no-object-parameters, anti-slop/no-runtime-typeof, typescript/array-type */
// TEMP instrumentation for the login → dashboard race. Remove before merge.
import type { ConvexReactClient } from "convex/react";

type DebugValue = string | number | boolean | null | undefined;

type DebugEvent = {
  at: string;
  data: Record<string, DebugValue>;
  event: string;
  t: number;
};

const events: DebugEvent[] = [];

function nowMs() {
  return typeof performance === "undefined" ? Date.now() : Math.round(performance.now());
}

export function describeToken(token: string | null | undefined) {
  if (token === null || token === undefined) {
    return "null";
  }
  const parts = token.split(".");
  if (parts.length === 3) {
    return `jwt(${token.length})`;
  }
  return `opaque(${token.length})`;
}

export function authDebug(event: string, data: Record<string, DebugValue>) {
  if (globalThis.window === undefined) {
    return;
  }
  const entry: DebugEvent = { at: new Date().toISOString(), data, event, t: nowMs() };
  events.push(entry);
  Reflect.set(globalThis, "__authDebug", events);
  console.info(`[auth-debug ${entry.t}ms] ${event}`, JSON.stringify(data));
}

const instrumented = new WeakSet<object>();

type SetAuthArgs = Parameters<ConvexReactClient["setAuth"]>;

/** Wrap `setAuth` / `clearAuth` so every owner (ours or the provider) shows up in the log. */
export function instrumentConvexClient(client: ConvexReactClient) {
  if (globalThis.window === undefined || instrumented.has(client)) {
    return;
  }
  instrumented.add(client);
  let seq = 0;
  const originalSetAuth = client.setAuth.bind(client);
  const originalClearAuth = client.clearAuth.bind(client);
  client.setAuth = (...args: SetAuthArgs) => {
    seq += 1;
    const mySeq = seq;
    const stack = (new Error("setAuth").stack ?? "").split("\n").slice(2, 5).join(" | ");
    authDebug("convex.setAuth", { seq: mySeq, stack });
    const fetchToken = args[0];
    const wrappedFetch: SetAuthArgs[0] = async (opts) => {
      const started = nowMs();
      const token = await fetchToken(opts);
      authDebug("convex.fetchToken", {
        forceRefreshToken: opts.forceRefreshToken,
        ms: nowMs() - started,
        seq: mySeq,
        token: describeToken(token),
      });
      return token;
    };
    const onChange = args[1];
    const wrappedOnChange = (isAuthenticated: boolean) => {
      authDebug("convex.onAuthChange", { isAuthenticated, seq: mySeq });
      onChange?.(isAuthenticated);
    };
    originalSetAuth(wrappedFetch, wrappedOnChange, args[2]);
  };
  client.clearAuth = () => {
    const stack = (new Error("clearAuth").stack ?? "").split("\n").slice(2, 5).join(" | ");
    authDebug("convex.clearAuth", { stack });
    originalClearAuth();
  };
}
