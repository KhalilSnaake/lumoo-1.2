-- add_device_tokens.sql
-- Tokens push, isolés et verrouillés. Le token est une capacité "bearer" :
-- aucune lecture/écriture directe côté client. Lecture = service_role uniquement.

CREATE TABLE IF NOT EXISTS device_tokens (
  token       TEXT PRIMARY KEY,                 -- ExpoPushToken (unique par appareil/app)
  device_id   TEXT NOT NULL,                    -- identifiant d'appareil stable (généré côté app)
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- rempli si connecté
  platform    TEXT,                             -- 'ios' | 'android'
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_device_id ON device_tokens(device_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
-- RLS active sans policy => tout accès client refusé. service_role bypass la RLS.

-- Enregistrement contrôlé via fonction SECURITY DEFINER : le client (même invité/anon)
-- peut appeler cette RPC, mais ne touche jamais la table directement.
CREATE OR REPLACE FUNCTION register_device_token(p_token TEXT, p_device_id TEXT, p_platform TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_token IS NULL OR length(p_token) < 10 OR p_device_id IS NULL OR length(p_device_id) < 4 THEN
    RAISE EXCEPTION 'invalid token or device_id';
  END IF;
  INSERT INTO device_tokens (token, device_id, user_id, platform, updated_at)
  VALUES (p_token, p_device_id, auth.uid(), p_platform, now())
  ON CONFLICT (token) DO UPDATE
    SET device_id = EXCLUDED.device_id, user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform, updated_at = now();
END; $$;

REVOKE ALL ON FUNCTION register_device_token(TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_device_token(TEXT,TEXT,TEXT) TO anon, authenticated;
