type AgentDebugEntry = {
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
};

export function agentDebugLog(entry: AgentDebugEntry) {
  if (typeof window === "undefined") {
    return;
  }
  void fetch("/_agent-debug", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...entry, timestamp: Date.now() }),
    keepalive: true,
  }).catch(() => {});
}

type ShareLinkDebugEvent = {
  source: "baby-nav" | "onboarding";
  event: "mount" | "pointer-enter" | "focus" | "click";
  href: string | null;
};

export function agentDebugShareLinkEvent(event: ShareLinkDebugEvent) {
  // #region agent log
  agentDebugLog({
    hypothesisId: "A,C",
    location: `${event.source}:share-link`,
    message: "Share link lifecycle event",
    data: { event: event.event, href: event.href },
  });
  // #endregion
}
