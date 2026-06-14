import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AsyncStorageLike } from './storage';

export interface CoreConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Stockage de session injecté par l'app hôte. Omis sur web (localStorage par défaut). */
  storage?: AsyncStorageLike;
  /** false sur mobile (pas d'URL de redirection à parser). Défaut: true (web). */
  detectSessionInUrl?: boolean;
  /** Base d'URL pour les liens de reset de mot de passe (ex. https://lumoo.ml). */
  authRedirectUrl?: string;
}

let client: SupabaseClient | null = null;
let authRedirectUrl: string | undefined;

export function initCore(config: CoreConfig): SupabaseClient {
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      ...(config.storage ? { storage: config.storage } : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: config.detectSessionInUrl ?? true,
    },
  });
  authRedirectUrl = config.authRedirectUrl;
  return client;
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error("Supabase non initialisé : appelez initCore(config) au démarrage de l'app.");
  }
  return client;
}

/** URL de redirection pour le reset de mot de passe (paramétrée par plateforme). */
export function getAuthRedirectUrl(): string | undefined {
  return authRedirectUrl;
}
