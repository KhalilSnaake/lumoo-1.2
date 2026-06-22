// send-push : Edge Function générique d'envoi de push Expo.
// Appelée SERVER-TO-SERVER par les triggers Postgres (pg_net), gardée par un secret
// partagé (x-webhook-secret) — déployer avec --no-verify-jwt.
// Résout les tokens par user_id (tous les appareils) ET/OU device_id (invité).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET")!;
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN") ?? "";

const json = (s: number, d: unknown) =>
  new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) return json(401, { error: "unauthorized" });

  const { userId, deviceId, title, message, data } = await req.json().catch(() => ({}));
  if (!title || !message) return json(400, { error: "title/message required" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const tokens = new Set<string>();

  if (userId) {
    const { data: rows } = await admin.from("device_tokens").select("token").eq("user_id", userId);
    rows?.forEach((r: { token: string }) => tokens.add(r.token));
  }
  if (deviceId) {
    const { data: rows } = await admin.from("device_tokens").select("token")
      .eq("device_id", deviceId).order("updated_at", { ascending: false }).limit(1);
    rows?.forEach((r: { token: string }) => tokens.add(r.token));
  }
  if (tokens.size === 0) return json(200, { skipped: true, reason: "no token" });

  const toks = [...tokens];
  const messages = toks.map((to) => ({ to, title, body: message, sound: "default", data: data ?? {} }));
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept": "application/json" };
  if (EXPO_ACCESS_TOKEN) headers["Authorization"] = `Bearer ${EXPO_ACCESS_TOKEN}`;

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST", headers, body: JSON.stringify(messages),
  });
  const body = await res.json();

  // Nettoyage des tokens morts (DeviceNotRegistered).
  const tickets = Array.isArray(body?.data) ? body.data : [];
  for (let i = 0; i < tickets.length; i++) {
    if (tickets[i]?.details?.error === "DeviceNotRegistered") {
      await admin.from("device_tokens").delete().eq("token", toks[i]);
    }
  }
  return json(200, { sent: true, count: messages.length });
});
