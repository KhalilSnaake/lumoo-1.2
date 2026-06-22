// Fonction serverless Vercel : envoi de push Expo.
// Appelée SERVER-TO-SERVER par les triggers Postgres (pg_net), gardée par un secret
// partagé (header x-webhook-secret). Résout les tokens par user_id (tous les appareils
// du compte) ET/OU device_id (client invité), puis envoie via Expo Push.
//
// Variables d'environnement à définir dans Vercel (Project Settings -> Environment Variables) :
//   SUPABASE_URL                (ou VITE_SUPABASE_URL, déjà présent pour le web)
//   SUPABASE_SERVICE_ROLE_KEY   (SECRET, server-only — ne JAMAIS préfixer VITE_)
//   PUSH_WEBHOOK_SECRET         (= la valeur push_webhook_secret de private.app_settings)
//   EXPO_ACCESS_TOKEN           (optionnel ; requis si "Enhanced Security" Expo activée)
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const WEBHOOK_SECRET = process.env.PUSH_WEBHOOK_SECRET || "";
const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN || "";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (req.headers["x-webhook-secret"] !== WEBHOOK_SECRET) return res.status(401).json({ error: "unauthorized" });

  const { userId, deviceId, title, message, data } = (req.body ?? {}) as {
    userId?: string; deviceId?: string; title?: string; message?: string; data?: unknown;
  };
  if (!title || !message) return res.status(400).json({ error: "title/message required" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const tokens = new Set<string>();

  if (userId) {
    const { data: rows } = await admin.from("device_tokens").select("token").eq("user_id", userId);
    (rows ?? []).forEach((r: { token: string }) => tokens.add(r.token));
  }
  if (deviceId) {
    const { data: rows } = await admin
      .from("device_tokens").select("token")
      .eq("device_id", deviceId).order("updated_at", { ascending: false }).limit(1);
    (rows ?? []).forEach((r: { token: string }) => tokens.add(r.token));
  }
  if (tokens.size === 0) return res.status(200).json({ skipped: true, reason: "no token" });

  const toks = [...tokens];
  const messages = toks.map((to) => ({ to, title, body: message, sound: "default", data: data ?? {} }));
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept": "application/json" };
  if (EXPO_ACCESS_TOKEN) headers["Authorization"] = `Bearer ${EXPO_ACCESS_TOKEN}`;

  const resp = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST", headers, body: JSON.stringify(messages),
  });
  const body = await resp.json();

  // Nettoyage des tokens morts (DeviceNotRegistered).
  const tickets = Array.isArray(body?.data) ? body.data : [];
  for (let i = 0; i < tickets.length; i++) {
    if (tickets[i]?.details?.error === "DeviceNotRegistered") {
      await admin.from("device_tokens").delete().eq("token", toks[i]);
    }
  }
  return res.status(200).json({ sent: true, count: messages.length });
}
