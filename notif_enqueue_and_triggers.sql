-- notif_enqueue_and_triggers.sql
-- Cœur du système : helper central + triggers. Tout est déclenché côté serveur
-- (infalsifiable, marche quel que soit l'émetteur : invité, admin, livreur, SQL).

-- 1) Helper : opt-out par catégorie, insert in-app (si user connu), push via pg_net.
CREATE OR REPLACE FUNCTION enqueue_notification(
  p_user_id TEXT, p_device_id TEXT, p_title TEXT, p_message TEXT,
  p_type TEXT, p_order_id TEXT, p_category TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  pref notification_preferences%ROWTYPE;
  base TEXT; secret TEXT;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO pref FROM notification_preferences WHERE user_id = p_user_id;
    IF FOUND THEN
      -- Garde-fou : opt-out par catégorie
      IF p_category = 'order'     AND pref.order_updates = false THEN RETURN; END IF;
      IF p_category = 'promo'     AND pref.promotions    = false THEN RETURN; END IF;
      IF p_category = 'admin_ops' AND pref.admin_ops     = false THEN RETURN; END IF;
    END IF;
    INSERT INTO notifications(user_id, title, message, type, order_id)
    VALUES (p_user_id, p_title, p_message, p_type, p_order_id);
  END IF;

  -- Push (server-to-server). Invité => p_user_id NULL mais p_device_id présent.
  SELECT value INTO base   FROM private.app_settings WHERE key = 'functions_base_url';
  SELECT value INTO secret FROM private.app_settings WHERE key = 'push_webhook_secret';
  IF base IS NOT NULL THEN
    PERFORM net.http_post(
      url := base || '/send-push',
      headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', secret),
      body := jsonb_build_object('userId', p_user_id, 'deviceId', p_device_id,
        'title', p_title, 'message', p_message,
        'data', jsonb_build_object('orderId', p_order_id, 'type', p_type))
    );
  END IF;
END; $$;

-- 2) Trigger commandes : INSERT (admins) + UPDATE statut (client) + UPDATE livreur (livreur)
CREATE OR REPLACE FUNCTION trg_orders_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE title TEXT; msg TEXT; adm RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR adm IN SELECT id FROM users WHERE role = 'admin' LOOP
      PERFORM enqueue_notification(adm.id, NULL, '📦 Nouvelle commande !',
        'Commande ' || NEW.id || ' — ' || NEW.total_price || ' F par ' || NEW.customer_name || '.',
        'new_order', NEW.id, 'admin_ops');
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'confirmee'      THEN title := 'Commande confirmée ✅'; msg := 'Votre commande est confirmée. Nous la préparons.';
      WHEN 'en_preparation' THEN title := 'En préparation 👨‍🍳';  msg := 'Votre commande est en cours de préparation.';
      WHEN 'en_livraison'   THEN title := 'En route 🛵';          msg := 'Votre commande est en route vers vous !';
      WHEN 'livree'         THEN title := 'Livrée 🎉';            msg := 'Votre commande a été livrée. Merci !';
      WHEN 'annulee'        THEN title := 'Commande annulée';     msg := 'Votre commande a été annulée. Contactez-nous si besoin.';
      ELSE title := NULL;
    END CASE;
    IF title IS NOT NULL THEN
      PERFORM enqueue_notification(NEW.user_id, NEW.device_id, title, msg, 'status_change', NEW.id, 'order');
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.livreur_id IS DISTINCT FROM OLD.livreur_id AND NEW.livreur_id IS NOT NULL THEN
    PERFORM enqueue_notification(NEW.livreur_id, NULL, '🛵 Nouvelle mission !',
      'La commande ' || NEW.id || ' vous a été assignée.', 'assignment', NEW.id, 'admin_ops');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS orders_notify_ins ON orders;
CREATE TRIGGER orders_notify_ins AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION trg_orders_notify();
DROP TRIGGER IF EXISTS orders_notify_upd ON orders;
CREATE TRIGGER orders_notify_upd AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION trg_orders_notify();

-- 3) Trigger contact : nouveau message -> admins
CREATE OR REPLACE FUNCTION trg_contact_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE adm RECORD;
BEGIN
  FOR adm IN SELECT id FROM users WHERE role = 'admin' LOOP
    PERFORM enqueue_notification(adm.id, NULL, '✉️ Nouveau message',
      COALESCE(NEW.name,'Un client') || ' vous a écrit.', 'new_message', NULL, 'admin_ops');
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS contact_notify_ins ON contact_messages;
CREATE TRIGGER contact_notify_ins AFTER INSERT ON contact_messages FOR EACH ROW EXECUTE FUNCTION trg_contact_notify();
