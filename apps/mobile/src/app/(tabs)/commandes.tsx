import { memo, useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { MapPin, Package, ShoppingBag } from "lucide-react-native";
import { useAuth, useOrders, type Order, type OrderStatus } from "@lumoo/core";
import { getRecentOrders, type RecentOrder } from "@/lib/recent-orders";

const CARD_SHADOW = {
  shadowColor: "#0F172A",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

const STATUS: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  en_attente: { label: "En attente", bg: "bg-amber-100", text: "text-amber-700" },
  confirmee: { label: "Confirmée", bg: "bg-blue-100", text: "text-blue-700" },
  en_preparation: { label: "En préparation", bg: "bg-indigo-100", text: "text-indigo-700" },
  en_livraison: { label: "En livraison", bg: "bg-orange-100", text: "text-orange-700" },
  livree: { label: "Livrée", bg: "bg-green-100", text: "text-green-700" },
  annulee: { label: "Annulée", bg: "bg-red-100", text: "text-red-700" },
};

function formatFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function CommandesScreen() {
  const { user } = useAuth();
  const { orders, loading, refreshOrders } = useOrders();
  const [recent, setRecent] = useState<RecentOrder[]>([]);

  // Rafraîchit à chaque ouverture : commandes serveur (connecté) + commandes
  // enregistrées localement sur l'appareil (invité, sans compte).
  useFocusEffect(
    useCallback(() => {
      refreshOrders();
      if (!user) getRecentOrders().then(setRecent);
    }, [refreshOrders, user]),
  );

  // ───── Invité : pas de compte → on s'appuie sur les commandes locales (n° + code) ─────
  if (!user) {
    if (recent.length === 0) {
      return (
        <View className="flex-1 items-center justify-center bg-gray-50 px-8">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-green-50">
            <ShoppingBag size={40} color="#16a34a" />
          </View>
          <Text className="mt-4 font-display text-lg text-gray-800">Suivre une commande</Text>
          <Text className="mt-1 text-center font-body text-gray-500">
            Entre ton numéro de commande et ton code de livraison — pas besoin de compte.
          </Text>
          <Pressable
            onPress={() => router.push("/suivi")}
            accessibilityRole="button"
            style={CARD_SHADOW}
            className="mt-6 h-12 w-full items-center justify-center rounded-2xl bg-brand px-6 active:opacity-80"
          >
            <Text className="font-display-semibold text-white">📍 Suivre ma commande</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/catalogue")}
            accessibilityRole="button"
            className="mt-3 h-12 w-full items-center justify-center rounded-2xl bg-gray-100 px-6 active:opacity-80"
          >
            <Text className="font-body-semibold text-gray-700">Voir le catalogue</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <FlatList
        className="flex-1 bg-gray-50"
        data={recent}
        keyExtractor={(o) => o.id}
        contentContainerClassName="p-4"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="mb-3">
            <Text className="font-display text-lg text-ink">Tes commandes récentes</Text>
            <Text className="mt-0.5 font-body text-xs text-gray-400">
              Enregistrées sur cet appareil — touche une commande pour la suivre.
            </Text>
          </View>
        }
        renderItem={({ item }) => <RecentOrderCard order={item} />}
        ListFooterComponent={
          <Pressable
            onPress={() => router.push("/suivi")}
            accessibilityRole="button"
            className="mt-1 h-12 items-center justify-center rounded-2xl bg-gray-100 active:opacity-80"
          >
            <Text className="font-body-semibold text-gray-700">Suivre une autre commande (n° + code)</Text>
          </Pressable>
        }
      />
    );
  }

  // ───── Connecté : commandes serveur (RLS Supabase + filtre user_id) ─────
  const myOrders = orders.filter((o) => o.userId === user.id);

  if (loading && myOrders.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color="#16a34a" />
        <Text className="mt-2 font-body text-gray-500">Chargement de tes commandes…</Text>
      </View>
    );
  }

  if (myOrders.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-green-50">
          <ShoppingBag size={40} color="#16a34a" />
        </View>
        <Text className="mt-4 font-display text-lg text-gray-800">
          Aucune commande pour l&apos;instant
        </Text>
        <Text className="mt-1 text-center font-body text-gray-500">
          Parcours le catalogue et passe ta première commande.
        </Text>
        <Pressable
          onPress={() => router.replace("/catalogue")}
          accessibilityRole="button"
          style={CARD_SHADOW}
          className="mt-6 h-12 items-center justify-center rounded-2xl bg-brand px-6 active:opacity-80"
        >
          <Text className="font-display-semibold text-white">Découvrir le catalogue</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-gray-50"
      data={myOrders}
      keyExtractor={(o) => o.id}
      contentContainerClassName="p-4"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refreshOrders}
          tintColor="#16a34a"
          colors={["#16a34a"]}
        />
      }
      renderItem={({ item }) => <OrderCard order={item} />}
    />
  );
}

const OrderCard = memo(function OrderCard({ order }: { order: Order }) {
  const status = STATUS[order.status] ?? STATUS.en_attente;
  const itemCount = order.items.reduce((s, it) => s + it.quantity, 0);
  const preview = order.items
    .slice(0, 2)
    .map((it) => `${it.emoji} ${it.name} × ${it.quantity}`)
    .join(", ");
  const more = order.items.length > 2 ? ` +${order.items.length - 2}` : "";

  return (
    <Pressable
      onPress={() => router.push(`/commande/${order.id}`)}
      accessibilityRole="button"
      className="mb-3 rounded-3xl bg-white p-4 active:opacity-90"
      style={CARD_SHADOW}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-gray-900">{order.id}</Text>
        <View className={`rounded-full px-3 py-1 ${status.bg}`}>
          <Text className={`text-xs font-bold ${status.text}`}>{status.label}</Text>
        </View>
      </View>

      <Text className="mt-1 text-xs text-gray-400">{formatDate(order.createdAt)}</Text>

      <View className="mt-3 flex-row items-start">
        <Package size={18} color="#9CA3AF" />
        <Text className="ml-2 flex-1 font-body text-gray-600">
          {itemCount} article{itemCount > 1 ? "s" : ""}
          {preview ? ` · ${preview}${more}` : ""}
        </Text>
      </View>

      {!!order.city && (
        <Text className="mt-1 text-xs text-gray-400">
          {order.address ? `${order.address}, ` : ""}
          {order.city}
        </Text>
      )}

      {!!order.deliveryCode && (
        <View className="mt-3 rounded-2xl bg-green-50 px-3 py-2">
          <View className="flex-row items-center justify-between">
            <Text className="font-body text-xs text-green-700">Code de retrait</Text>
            <Text className="font-display text-base tracking-widest text-green-800">{order.deliveryCode}</Text>
          </View>
          <Text className="mt-1 font-body text-[11px] text-amber-700">
            ⚠️ À donner au livreur uniquement à la réception du colis.
          </Text>
        </View>
      )}

      <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-3">
        <Text className="font-body text-gray-500">Total</Text>
        <Text className="font-display text-lg text-brand">{formatFCFA(order.totalPrice)}</Text>
      </View>
    </Pressable>
  );
});

// Carte d'une commande enregistrée localement (invité). Touche → suivi auto via /suivi.
const RecentOrderCard = memo(function RecentOrderCard({ order }: { order: RecentOrder }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/suivi", params: { id: order.id, code: order.code } })}
      accessibilityRole="button"
      accessibilityLabel={`Suivre la commande ${order.id}`}
      className="mb-3 rounded-3xl bg-white p-4 active:opacity-90"
      style={CARD_SHADOW}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-gray-900">{order.id}</Text>
        <View className="flex-row items-center gap-1 rounded-full bg-green-50 px-3 py-1">
          <MapPin size={13} color="#16a34a" />
          <Text className="text-xs font-bold text-green-700">Suivre</Text>
        </View>
      </View>

      {!!order.date && <Text className="mt-1 text-xs text-gray-400">{formatDate(order.date)}</Text>}

      <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-3">
        <View className="flex-row items-center gap-2 rounded-xl bg-green-50 px-3 py-1.5">
          <Text className="font-body text-[11px] text-green-700">Code</Text>
          <Text className="font-display tracking-widest text-green-800">{order.code}</Text>
        </View>
        {order.total > 0 ? (
          <Text className="font-display text-lg text-brand">{formatFCFA(order.total)}</Text>
        ) : null}
      </View>
      <Text className="mt-2 font-body text-[11px] text-amber-700">
        ⚠️ À donner au livreur uniquement à la réception du colis.
      </Text>
    </Pressable>
  );
});
