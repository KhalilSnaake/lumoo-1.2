import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, MapPin, Phone, Search } from "lucide-react-native";
import { apiTrackOrder, type OrderStatus, type PaymentMethod } from "@lumoo/core";

function formatFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

const PAYMENT_NAMES: Record<PaymentMethod, string> = {
  orange_money: "Orange Money",
  moov_money: "Moov Money",
  wave: "Wave",
  livraison: "Paiement à la livraison",
};

const STATUS: Record<OrderStatus, { label: string; emoji: string; desc: string }> = {
  en_attente: { label: "En attente", emoji: "⏳", desc: "Commande reçue, en attente de confirmation." },
  confirmee: { label: "Confirmée", emoji: "✅", desc: "Commande confirmée par notre équipe." },
  en_preparation: { label: "En préparation", emoji: "📦", desc: "Votre commande est en préparation." },
  en_livraison: { label: "En livraison", emoji: "🚚", desc: "Votre commande est en route vers vous !" },
  livree: { label: "Livrée", emoji: "🎉", desc: "Votre commande a été livrée." },
  annulee: { label: "Annulée", emoji: "❌", desc: "Cette commande a été annulée." },
};

const STEPS: OrderStatus[] = ["en_attente", "confirmee", "en_preparation", "en_livraison", "livree"];

type TrackedItem = { name: string; emoji?: string; price: number; quantity: number; unit?: string };
type TrackedOrder = {
  id: string;
  status: OrderStatus;
  deliveryCode: string;
  customerName: string;
  address: string;
  city: string;
  gps_lat: number | null;
  gps_lng: number | null;
  paymentMethod: PaymentMethod;
  totalPrice: number;
  createdAt: string;
  livreur: { name: string; phone: string } | null;
  items: TrackedItem[];
};

export default function SuiviScreen() {
  const insets = useSafeAreaInsets();
  const [orderId, setOrderId] = useState("");
  const [code, setCode] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!orderId.trim() || !code.trim()) return;
    setSearching(true);
    setError(null);
    setOrder(null);
    try {
      const data = await apiTrackOrder(orderId, code);
      if (!data) setError("Commande introuvable. Vérifie le numéro et le code de livraison.");
      else setOrder(data as TrackedOrder);
    } catch {
      setError("Une erreur est survenue. Réessaie.");
    } finally {
      setSearching(false);
    }
  };

  const stepIndex = order ? STEPS.indexOf(order.status) : -1;

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center border-b border-gray-100 bg-white px-3 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Retour" className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="ml-1 font-display text-lg text-ink">Suivi de livraison</Text>
      </View>

      <ScrollView contentContainerClassName="p-4" keyboardShouldPersistTaps="handled">
        {/* Recherche */}
        <View className="gap-2">
          <TextInput
            value={orderId}
            onChangeText={setOrderId}
            placeholder="N° commande — Ex : LUM-M5X7KQ-A2B4"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            accessibilityLabel="Numéro de commande"
            className="min-h-12 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-body text-gray-900"
          />
          <View className="flex-row gap-2">
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Code de livraison (4 chiffres)"
              placeholderTextColor="#9CA3AF"
              inputMode="numeric"
              accessibilityLabel="Code de livraison"
              className="min-h-12 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-body text-gray-900"
            />
            <Pressable
              onPress={search}
              disabled={searching || !orderId.trim() || !code.trim()}
              accessibilityRole="button"
              accessibilityLabel="Rechercher"
              className={`h-12 w-14 items-center justify-center rounded-2xl bg-brand active:opacity-80 ${searching || !orderId.trim() || !code.trim() ? "opacity-50" : ""}`}
            >
              {searching ? <ActivityIndicator color="#ffffff" /> : <Search size={20} color="#ffffff" />}
            </Pressable>
          </View>
          {error ? <Text className="mt-1 font-body text-sm text-red-600">{error}</Text> : null}
        </View>

        {/* Résultat */}
        {order ? (
          <View className="mt-5 gap-5">
            {/* Statut */}
            <View className="items-center rounded-3xl bg-white p-5">
              <Text className="text-5xl">{STATUS[order.status].emoji}</Text>
              <Text className="mt-2 font-display text-xl text-ink">{STATUS[order.status].label}</Text>
              <Text className="mt-1 text-center font-body text-sm text-gray-500">{STATUS[order.status].desc}</Text>
            </View>

            {/* Progression */}
            {order.status !== "annulee" ? (
              <View className="flex-row gap-1.5">
                {STEPS.map((s, i) => (
                  <View key={s} className="flex-1">
                    <View className={`h-1.5 w-full rounded-full ${i <= stepIndex ? "bg-brand" : "bg-gray-200"}`} />
                    <Text className={`mt-1 text-center text-[9px] ${i <= stepIndex ? "text-brand" : "text-gray-300"}`}>{STATUS[s].label}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Livreur */}
            {order.livreur ? (
              <View className="rounded-3xl bg-white p-4">
                <Text className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">🛵 Livreur assigné</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="font-display text-gray-800">{order.livreur.name}</Text>
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${order.livreur!.phone}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Appeler ${order.livreur.name}`}
                    className="flex-row items-center gap-1.5 rounded-xl bg-green-50 px-3 py-2 active:opacity-80"
                  >
                    <Phone size={14} color="#16a34a" />
                    <Text className="font-body-semibold text-green-700">{order.livreur.phone}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Détails */}
            <View className="rounded-3xl bg-white p-4">
              <Detail label="N° Commande" value={order.id} mono />
              <Detail label="Client" value={order.customerName} />
              <Detail label="Adresse" value={`${order.address}, ${order.city}`} />
              {order.gps_lat && order.gps_lng ? (
                <Pressable
                  onPress={() => Linking.openURL(`https://www.google.com/maps?q=${order.gps_lat},${order.gps_lng}`)}
                  accessibilityRole="button"
                  className="mb-2 flex-row items-center gap-1.5 active:opacity-70"
                >
                  <MapPin size={13} color="#3B82F6" />
                  <Text className="font-body-semibold text-[12px] text-blue-500">Voir sur la carte</Text>
                </Pressable>
              ) : null}
              <Detail label="Paiement" value={PAYMENT_NAMES[order.paymentMethod]} />
              <Detail label="Code livraison" value={order.deliveryCode} mono />

              <View className="mt-2 border-t border-gray-100 pt-2">
                {order.items.map((it, i) => (
                  <View key={i} className="flex-row justify-between py-0.5">
                    <Text className="font-body text-sm text-gray-600">{it.emoji || "📦"} {it.name} × {it.quantity}</Text>
                    <Text className="font-body-semibold text-sm text-gray-700">{formatFCFA(it.price * it.quantity)}</Text>
                  </View>
                ))}
              </View>
              <View className="mt-2 flex-row justify-between border-t border-gray-100 pt-2">
                <Text className="font-display text-gray-800">Total</Text>
                <Text className="font-display text-lg text-brand">{formatFCFA(order.totalPrice)}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="mb-2 flex-row justify-between">
      <Text className="font-body text-sm text-gray-400">{label}</Text>
      <Text className={`max-w-[60%] text-right font-body-semibold text-sm text-gray-700 ${mono ? "font-mono" : ""}`}>{value}</Text>
    </View>
  );
}
