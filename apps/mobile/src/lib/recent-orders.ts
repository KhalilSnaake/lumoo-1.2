import AsyncStorage from "@react-native-async-storage/async-storage";

// Commandes enregistrées LOCALEMENT sur l'appareil (n° + code de livraison).
// But : permettre à un invité (sans compte) de re-suivre ses commandes sans
// retaper le numéro ni le code. ⚠️ Local uniquement : effacé à la désinstallation,
// pas de synchro multi-appareils — un compte reste nécessaire pour un historique durable.

const KEY = "lumoo:recent_orders";
const MAX = 10;

export type RecentOrder = {
  id: string;
  code: string;
  /** ISO date — affichage uniquement */
  date: string;
  /** total FCFA — affichage uniquement */
  total: number;
};

function isRecentOrder(o: unknown): o is RecentOrder {
  return (
    !!o &&
    typeof o === "object" &&
    typeof (o as RecentOrder).id === "string" &&
    typeof (o as RecentOrder).code === "string"
  );
}

export async function getRecentOrders(): Promise<RecentOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentOrder);
  } catch {
    return [];
  }
}

export async function saveRecentOrder(order: RecentOrder): Promise<void> {
  try {
    const existing = await getRecentOrders();
    // Dédoublonne par id, place la plus récente en tête, plafonne à MAX.
    const next = [order, ...existing.filter((o) => o.id !== order.id)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Best-effort : ne jamais bloquer le checkout si le stockage échoue.
  }
}

export async function removeRecentOrder(id: string): Promise<void> {
  try {
    const existing = await getRecentOrders();
    await AsyncStorage.setItem(KEY, JSON.stringify(existing.filter((o) => o.id !== id)));
  } catch {
    // Best-effort.
  }
}
