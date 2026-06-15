export type RecoveryParams = { access_token: string; refresh_token: string };

/** Extrait les tokens d'un lien de recovery Supabase (flux implicite, fragment `#`). */
export function parseRecoveryParams(url: string | null): RecoveryParams | null {
  if (!url) return null;
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;
  const params = new URLSearchParams(url.slice(hashIndex + 1));
  if (params.get("type") !== "recovery") return null;
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}
