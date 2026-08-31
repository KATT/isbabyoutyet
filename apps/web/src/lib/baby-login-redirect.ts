/**
 * Allowlist for `/auth/login?redirect=` so a PWA logo escape hatch can return
 * to that baby page without becoming an open redirect.
 */
export function loginRedirectQuery(searchStr: string) {
  const params = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr);
  const value = params.get("redirect");
  return value === null ? undefined : value;
}

/** @internal Exported for tests. */
export function parseBabyLoginPublicId(redirect: string | undefined): string | null {
  if (redirect === undefined) {
    return null;
  }
  if (!redirect.startsWith("/baby/")) {
    return null;
  }
  if (
    redirect.includes("//") ||
    redirect.includes("\\") ||
    redirect.includes("?") ||
    redirect.includes("#") ||
    redirect.includes("%")
  ) {
    return null;
  }
  const publicId = redirect.slice("/baby/".length);
  if (publicId.length === 0 || publicId.includes("/")) {
    return null;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(publicId)) {
    return null;
  }
  return publicId;
}

export function babyLoginHomeLink(redirect: string | undefined) {
  const publicId = parseBabyLoginPublicId(redirect);
  if (publicId === null) {
    return { to: "/" as const };
  }
  return { to: "/baby/$publicId" as const, params: { publicId } };
}

export function babyLoginSuccessTarget(redirect: string | undefined) {
  const publicId = parseBabyLoginPublicId(redirect);
  if (publicId === null) {
    return { to: "/dashboard" as const };
  }
  return { to: "/baby/$publicId" as const, params: { publicId } };
}
