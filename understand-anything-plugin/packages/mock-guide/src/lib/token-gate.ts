/**
 * Client-safe token utilities.
 * The client never generates the token — it reads it from the URL ?token= param
 * and passes it along to API calls. Token generation is server-only (api-utils.ts).
 */

let cachedToken: string | null = null;

export function getAccessToken(): string {
  if (cachedToken) return cachedToken;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    cachedToken = params.get("token") ?? "";
  }
  return cachedToken ?? "";
}

export function validateToken(token: string | null): boolean {
  return token === getAccessToken();
}