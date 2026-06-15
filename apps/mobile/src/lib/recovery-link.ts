export type AuthCallbackType = "recovery" | "signup" | "email";
export type AuthCallback = { type: AuthCallbackType; access_token: string; refresh_token: string };

const TYPES: AuthCallbackType[] = ["recovery", "signup", "email"];

/** Extrait `type` + tokens d'un lien d'auth Supabase (flux implicite, fragment `#`). */
export function parseAuthCallback(url: string | null): AuthCallback | null {
  if (!url) return null;
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;
  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const type = params.get("type");
  if (!type || !TYPES.includes(type as AuthCallbackType)) return null;
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { type: type as AuthCallbackType, access_token, refresh_token };
}

/** Compat ascendante : restreint au type recovery (consommé par `_layout` jusqu'à sa mise à jour). */
export function parseRecoveryParams(url: string | null) {
  const cb = parseAuthCallback(url);
  return cb && cb.type === "recovery"
    ? { access_token: cb.access_token, refresh_token: cb.refresh_token }
    : null;
}
