import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useAuth, getSupabase } from "@lumoo/core";

// Garde-fou : opt-out par catégorie. Lecture/écriture de la ligne de l'utilisateur connecté
// (RLS : chacun ne voit/modifie que sa propre ligne).
export function NotificationPreferences() {
  const { user } = useAuth();
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(true);

  useEffect(() => {
    if (!user) return;
    getSupabase()
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setOrderUpdates(data.order_updates);
          setPromotions(data.promotions);
        }
      });
  }, [user]);

  async function save(patch: { order_updates?: boolean; promotions?: boolean }) {
    if (!user) return;
    await getSupabase()
      .from("notification_preferences")
      .upsert({ user_id: user.id, order_updates: orderUpdates, promotions, ...patch });
  }

  if (!user) return null;

  return (
    <View className="overflow-hidden rounded-3xl bg-white">
      <View className="px-4 pt-4">
        <Text className="font-display text-base text-gray-900">Notifications</Text>
      </View>
      <PrefRow
        label="Suivi de mes commandes"
        value={orderUpdates}
        onChange={(v) => {
          setOrderUpdates(v);
          void save({ order_updates: v });
        }}
      />
      <View className="ml-4 h-px bg-gray-100" />
      <PrefRow
        label="Offres & nouveautés"
        value={promotions}
        onChange={(v) => {
          setPromotions(v);
          void save({ promotions: v });
        }}
      />
    </View>
  );
}

function PrefRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="min-h-14 flex-row items-center justify-between px-4 py-2">
      <Text className="flex-1 font-body-semibold text-gray-800">{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: "#16a34a" }} />
    </View>
  );
}
