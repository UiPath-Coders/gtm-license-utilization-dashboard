// Decodes the access token's claims to identify the signed-in user, without
// any extra API call or scope. This is a client-side convenience check only —
// see AccessGate.tsx for why it is NOT the real security boundary.
export function decodeJwtEmail(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as Record<string, unknown>;
    const email =
      (claims.email as string | undefined) ??
      (claims.upn as string | undefined) ??
      (claims.preferred_username as string | undefined) ??
      (claims.unique_name as string | undefined);
    return email ? String(email).toLowerCase() : null;
  } catch {
    return null;
  }
}
