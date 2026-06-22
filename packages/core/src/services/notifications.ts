import { getSupabase } from '../lib/supabaseClient';

// Enregistrement du token push de l'appareil. Passe par la RPC SECURITY DEFINER
// (la table device_tokens est verrouillée côté client). Si l'utilisateur est connecté,
// la RPC rattache automatiquement le token à son user_id (auth.uid()).
export async function apiRegisterDeviceToken(
  token: string,
  deviceId: string,
  platform: string,
): Promise<boolean> {
  const { error } = await getSupabase().rpc('register_device_token', {
    p_token: token,
    p_device_id: deviceId,
    p_platform: platform,
  });
  return !error;
}
