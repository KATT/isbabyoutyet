export type PushPlatform = "ios" | "android" | "desktop";

export type PushDevice = {
  userAgent: string;
  platform: PushPlatform;
  osVersion: string | null;
};

/**
 * Best-effort UA parse for Web Push subscribers. Stored at subscribe time so
 * we can later gate payload features (e.g. iOS notification images) without
 * changing the send path today.
 */
export function parsePushDevice(userAgent: string): PushDevice {
  const platform = detectPlatform(userAgent);
  return {
    userAgent,
    platform,
    osVersion: detectOsVersion(userAgent, platform),
  };
}

function detectPlatform(userAgent: string): PushPlatform {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return "ios";
  }
  // iPadOS 13+ desktop UA still carries Mobile
  if (/\bMacintosh\b/.test(userAgent) && /Mobile/.test(userAgent)) {
    return "ios";
  }
  if (/Android/i.test(userAgent)) {
    return "android";
  }
  return "desktop";
}

function detectOsVersion(userAgent: string, platform: PushPlatform): string | null {
  if (platform === "ios") {
    const match = userAgent.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/);
    if (!match || !match[1] || !match[2]) return null;
    return match[3] ? `${match[1]}.${match[2]}.${match[3]}` : `${match[1]}.${match[2]}`;
  }
  if (platform === "android") {
    const match = userAgent.match(/Android (\d+(?:\.\d+)*)/);
    return match?.[1] ?? null;
  }
  const mac = userAgent.match(/Mac OS X (\d+)[._](\d+)(?:[._](\d+))?/);
  if (mac && mac[1] && mac[2]) {
    return mac[3] ? `${mac[1]}.${mac[2]}.${mac[3]}` : `${mac[1]}.${mac[2]}`;
  }
  const win = userAgent.match(/Windows NT (\d+\.\d+)/);
  return win?.[1] ?? null;
}
