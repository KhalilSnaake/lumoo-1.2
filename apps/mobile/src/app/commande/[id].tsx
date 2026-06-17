import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Truck } from "lucide-react-native";
import { useOrders, type OrderStatus, type PaymentMethod } from "@lumoo/core";

const STATUS: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  en_attente: { label: "En attente", bg: "bg-amber-100", text: "text-amber-700" },
  confirmee: { label: "Confirmée", bg: "bg-blue-100", text: "text-blue-700" },
  en_preparation: { label: "En préparation", bg: "bg-indigo-100", text: "text-indigo-700" },
  en_livraison: { label: "En livraison", bg: "bg-orange-100", text: "text-orange-700" },
  livree: { label: "Livrée", bg: "bg-green-100", text: "text-green-700" },
  annulee: { label: "Annulée", bg: "bg-red-100", text: "text-red-700" },
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  orange_money: "Orange Money",
  moov_money: "Moov Money",
  wave: "Wave",
  livraison: "Paiement à la livraison",
};

const BRAND_SHADOW = {
  shadowColor: "#16a34a",
  shadowOpacity: 0.25,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
  elevation: 4,
} as const;

function formatFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders } = useOrders();

  const order = useMemo(() => orders.find((o) => o.id === id), [orders, id]);

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Stack.Screen options={{ title: "Commande" }} />
        <Text className="text-center font-body text-gray-400">Commande introuvable.</Text>
      </View>
    );
  }

  const status = STATUS[order.status] ?? STATUS.en_attente;

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: order.id }} />
      <ScrollView contentContainerClassName="p-4 pb-10" showsVerticalScrollIndicator={false}>
        {/* En-tête statut */}
        <View className="rounded-3xl bg-white p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-display text-gray-900">{order.id}</Text>
            <View className={`rounded-full px-3 py-1 ${status.bg}`}>
              <Text className={`text-xs font-bold ${status.text}`}>{status.label}</Text>
            </View>
          </View>
          <Text className="mt-1 font-body text-xs text-gray-400">{formatDate(order.createdAt)}</Text>
        </View>

        {/* Suivi — mis en évidence */}
        <Pressable
          onPress={() =>
            router.push({ pathname: "/suivi", params: { id: order.id, code: order.deliveryCode } })
          }
          accessibilityRole="button"
          accessibilityLabel="Suivre ma commande"
          style={BRAND_SHADOW}
          className="mt-3 h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-brand active:opacity-80"
        >
          <Truck size={20} color="#ffffff" />
          <Text className="font-display-semibold text-base text-white">Suivre ma commande</Text>
        </Pressable>

        {/* Code de retrait */}
        {!!order.deliveryCode && (
          <View className="mt-3 items-center rounded-3xl bg-brand p-4">
            <Text className="font-body text-[11px] uppercase tracking-widest text-white opacity-80">
              Code de livraison
            </Text>
            <Text className="mt-1 font-display text-2xl text-white" style={{ letterSpacing: 6 }}>
              {order.deliveryCode}
            </Text>
            <Text className="mt-2 text-center font-body text-[11px] text-white opacity-90">
              ⚠️ À donner au livreur uniquement à la réception du colis.
            </Text>
          </View>
        )}

        {/* Articles */}
        <Text className="mb-2 ml-1 mt-6 text-xs font-bold uppercase tracking-wider text-gray-400">
          Articles
        </Text>
        <View className="rounded-3xl bg-white">
          {order.items.map((it, i) => (
            <View
              key={`${it.productId}-${i}`}
              className={`flex-row items-center px-4 py-3 ${i > 0 ? "border-t border-gray-100" : ""}`}
            >
              <View className="flex-1">
                <Text className="font-body-semibold text-gray-800">{it.name}</Text>
                <Text className="font-body text-xs text-gray-400">
                  {it.quantity} × {formatFCFA(it.price)}
                  {it.unit ? ` · ${it.unit}` : ""}
                </Text>
              </View>
              <Text className="font-display text-brand">{formatFCFA(it.price * it.quantity)}</Text>
            </View>
          ))}
          <View className="flex-row items-center justify-between border-t border-gray-100 px-4 py-3">
            <Text className="font-body text-gray-500">Total</Text>
            <Text className="font-display text-lg text-brand">{formatFCFA(order.totalPrice)}</Text>
          </View>
        </View>

        {/* Livraison & paiement */}
        <Text className="mb-2 ml-1 mt-6 text-xs font-bold uppercase tracking-wider text-gray-400">
          Livraison & paiement
        </Text>
        <View className="gap-px overflow-hidden rounded-3xl bg-white">
          <InfoRow label="Destinataire" value={order.customerName} />
          <InfoRow label="Téléphone" value={order.customerPhone} />
          <InfoRow
            label="Adresse"
            value={[order.address, order.city].filter(Boolean).join(", ")}
          />
          <InfoRow label="Paiement" value={PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod} />
        </View>

      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between bg-white px-4 py-3">
      <Text className="font-body text-gray-500">{label}</Text>
      <Text className="ml-4 flex-1 text-right font-body-semibold text-gray-800">{value || "—"}</Text>
    </View>
  );
}
