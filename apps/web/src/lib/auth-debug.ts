/* oxlint-disable no-console, anti-slop/no-object-parameters, anti-slop/no-runtime-typeof, typescript/array-type */
/**
 * TEMPORARY preview instrumentation for the login → /dashboard bounce.
 *
 * Records timestamped auth events to the console, `globalThis.__authDebug`
 * and `sessionStorage["authDebug"]` so they survive the SPA redirect back to
 * `/auth/login`. Remove before merging.
 */

type DebugValue = string | number | boolean | null | undefined;

type DebugEvent = {
  at: string;
  data: Record<string, DebugValue>;
  event: string;
  t: number;
};

const events: DebugEvent[] = [];
const ids = new WeakMap<object, string>();
let nextId = 0;

/** Stable short id per object so we can tell whether two references are the same instance. */
export function debugIdFor(obj: object | null | undefined, prefix: string) {
  if (!obj) {
    return `${prefix}:none`;
  }
  const existing = ids.get(obj);
  if (existing) {
    return existing;
  }
  nextId += 1;
  const id = `${prefix}#${nextId}`;
  ids.set(obj, id);
  return id;
}

function nowMs() {
  return typeof performance === "undefined" ? Date.now() : Math.round(performance.now());
}

export function authDebug(event: string, data: Record<string, DebugValue>) {
  if (globalThis.window === undefined) {
    return;
  }
  const entry: DebugEvent = { at: new Date().toISOString(), data, event, t: nowMs() };
  events.push(entry);
  Reflect.set(globalThis, "__authDebug", events);
  console.info(`[auth-debug ${entry.t}ms] ${event}`, data);
  try {
    globalThis.sessionStorage.setItem("authDebug", JSON.stringify(events));
  } catch {
    // storage unavailable — console is enough
  }
}

/** Dump the recorded events as one line-per-event string (call from DevTools: `__authDebugDump()`). */
export function installAuthDebugDump() {
  if (globalThis.window === undefined) {
    return;
  }
  Reflect.set(globalThis, "__authDebugDump", () => {
    const lines = events.map(
      (entry) => `${entry.t}\t${entry.event}\t${JSON.stringify(entry.data)}`,
    );
    console.info(lines.join("\n"));
    return lines.join("\n");
  });
  const previous = globalThis.sessionStorage.getItem("authDebug");
  if (previous) {
    authDebug("page-load", { hadPreviousEvents: true, url: globalThis.location.href });
  } else {
    authDebug("page-load", { hadPreviousEvents: false, url: globalThis.location.href });
  }
}
