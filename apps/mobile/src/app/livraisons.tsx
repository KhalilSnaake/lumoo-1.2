import { useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, MapPin, Phone } from "lucide-react-native";
import { useAuth, useOrders, type Order, type OrderStatus } from "@lumoo/core";

function formatFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

const STATUS: Record<OrderStatus, { label: string; emoji: string; tone: string }> = {
  en_attente: { label: "En attente", emoji: "⏳", tone: "bg-yellow-100 text-yellow-700" },
  confirmee: { label: "Confirmée", emoji: "✅", tone: "bg-blue-100 text-blue-700" },
  en_preparation: { label: "En préparation", emoji: "📦", tone: "bg-purple-100 text-purple-700" },
  en_livraison: { label: "En livraison", emoji: "🚚", tone: "bg-orange-100 text-orange-700" },
  livree: { label: "Livrée", emoji: "🎉", tone: "bg-green-100 text-green-700" },
  annulee: { label: "Annulée", emoji: "❌", tone: "bg-red-100 text-red-700" },
};

// Priorité d'affichage : à livrer d'abord, livrées à la fin.
const ORDER_RANK: Record<OrderStatus, number> = {
  en_livraison: 0, confirmee: 1, en_preparation: 1, en_attente: 2, livree: 3, annulee: 4,
};

export default function LivraisonsScreen() {
  const insets = useSafeAreaInsets();
  const { orders } = useOrders();
  const { user } = useAuth();

  const mine = (user ? orders.filter((o) => o.livreurId === user.id) : [])
    .slice()
    .sort((a, b) => ORDER_RANK[a.status] - ORDER_RANK[b.status]);

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center border-b border-gray-100 bg-white px-3 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Retour" className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="ml-1 font-display text-lg text-ink">Mes livraisons</Text>
        {mine.length > 0 ? (
          <View className="ml-auto rounded-full bg-brand px-2.5 py-1">
            <Text className="text-xs font-bold text-white">{mine.filter((o) => o.status === "en_livraison").length} à livrer</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={mine}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <DeliveryCard order={item} />}
        contentContainerClassName="p-4 gap-4"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          <View className="mt-16 items-center">
            <Text className="text-5xl">📭</Text>
            <Text className="mt-3 font-body text-gray-400">Aucune livraison assignée pour le moment.</Text>
          </View>
        }
      />
    </View>
  );
}

function DeliveryCard({ order }: { order: Order }) {
  const { updateOrder } = useOrders();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const st = STATUS[order.status];

  const validate = async () => {
    if (code !== order.deliveryCode) {
      setError("Code incorrect. Demande le code à 4 chiffres au client.");
      return;
    }
    if (!receivedBy.trim()) {
      setError("Saisis le nom de la personne qui reçoit le colis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateOrder(order.id, { status: "livree", receivedBy: receivedBy.trim() });
      setOpen(false);
    } catch {
      setError("Une erreur est survenue. Réessaie.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="rounded-3xl bg-white p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-display text-gray-900">{order.customerName}</Text>
          <Text className="mt-0.5 font-mono text-[11px] text-gray-400">{order.id}</Text>
        </View>
        <View className={`rounded-full px-2.5 py-1 ${st.tone}`}>
          <Text className="text-xs font-bold">{st.emoji} {st.label}</Text>
        </View>
      </View>

      <View className="mt-3 gap-1">
        <Text className="font-body text-sm text-gray-600">{order.address}, {order.city}</Text>
        {order.gps_lat && order.gps_lng ? (
          <Pressable
            onPress={() => Linking.openURL(`https://www.google.com/maps?q=${order.gps_lat},${order.gps_lng}`)}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 active:opacity-70"
          >
            <MapPin size={14} color="#3B82F6" />
            <Text className="font-body-semibold text-[12px] text-blue-500">Itinéraire (carte)</Text>
          </Pressable>
        ) : null}
        {order.customerPhone ? (
          <Pressable
            onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 active:opacity-70"
          >
            <Phone size={14} color="#16a34a" />
            <Text className="font-body-semibold text-[12px] text-green-700">{order.customerPhone}</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="mt-3 border-t border-gray-100 pt-2">
        {order.items.map((it, i) => (
          <View key={i} className="flex-row justify-between py-0.5">
            <Text className="font-body text-sm text-gray-600">{it.emoji || "📦"} {it.name} × {it.quantity}</Text>
            <Text className="font-body-semibold text-sm text-gray-700">{formatFCFA(it.price * it.quantity)}</Text>
          </View>
        ))}
        <View className="mt-1 flex-row justify-between">
          <Text className="font-display text-gray-800">Total</Text>
          <Text className="font-display text-brand">{formatFCFA(order.totalPrice)}</Text>
        </View>
      </View>

      {/* Validation (uniquement quand la commande est en livraison) */}
      {order.status === "en_livraison" ? (
        !open ? (
          <Pressable
            onPress={() => { setOpen(true); setError(null); }}
            accessibilityRole="button"
            className="mt-3 h-11 items-center justify-center rounded-2xl bg-brand active:opacity-80"
          >
            <Text className="font-display-semibold text-white">✅ Valider la livraison</Text>
          </Pressable>
        ) : (
          <View className="mt-3 rounded-2xl bg-gray-50 p-3">
            <Text className="text-center font-body text-[12px] text-gray-500">🔐 Demande au client le code à 4 chiffres de son suivi.</Text>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 4))}
              placeholder="Code (4 chiffres)"
              placeholderTextColor="#9CA3AF"
              inputMode="numeric"
              accessibilityLabel="Code de livraison"
              className="mt-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-mono text-lg text-gray-900"
            />
            <TextInput
              value={receivedBy}
              onChangeText={setReceivedBy}
              placeholder="Nom de la personne qui reçoit"
              placeholderTextColor="#9CA3AF"
              accessibilityLabel="Nom du receveur"
              className="mt-2 rounded-xl border border-gray-200 bg-white px-4 py-3 font-body text-gray-900"
            />
            {error ? <Text className="mt-2 font-body text-sm text-red-600">{error}</Text> : null}
            <View className="mt-3 flex-row gap-2">
              <Pressable onPress={() => { setOpen(false); setError(null); }} className="h-11 flex-1 items-center justify-center rounded-2xl bg-gray-200 active:opacity-80">
                <Text className="font-body-semibold text-gray-600">Annuler</Text>
              </Pressable>
              <Pressable
                onPress={validate}
                disabled={saving || code.length < 4 || !receivedBy.trim()}
                className={`h-11 flex-1 flex-row items-center justify-center rounded-2xl bg-brand active:opacity-80 ${saving || code.length < 4 || !receivedBy.trim() ? "opacity-50" : ""}`}
              >
                {saving ? <ActivityIndicator color="#ffffff" /> : <Text className="font-display-semibold text-white">Confirmer</Text>}
              </Pressable>
            </View>
          </View>
        )
      ) : order.status === "livree" && order.receivedBy ? (
        <Text className="mt-3 font-body text-[12px] text-green-700">🎉 Livrée à {order.receivedBy}</Text>
      ) : null}
    </View>
  );
}
