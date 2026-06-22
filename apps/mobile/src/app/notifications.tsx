import { type ReactNode, useCallback } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { Bell, Bike, MessageCircle, Package, RefreshCw, Trash2 } from "lucide-react-native";
import { useAuth, useNotifications, type Notification, type NotificationType } from "@lumoo/core";

const ICONS: Record<NotificationType, (color: string) => ReactNode> = {
  new_order: (c) => <Package size={20} color={c} />,
  assignment: (c) => <Bike size={20} color={c} />,
  status_change: (c) => <RefreshCw size={20} color={c} />,
  general: (c) => <Bell size={20} color={c} />,
  new_message: (c) => <MessageCircle size={20} color={c} />,
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function NotificationsScreen() {
  const { isLoggedIn } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, fetchNotifications } =
    useNotifications();

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications]),
  );

  function onPressNotif(n: Notification) {
    if (!n.read) void markAsRead(n.id);
    // Mission livreur (assignment) → ses courses assignées ;
    // sinon (commande du client) → ses commandes.
    if (n.type === "assignment") {
      router.push("/livraisons");
    } else if (n.orderId) {
      router.push(`/commande/${n.orderId}`);
    }
  }

  if (!isLoggedIn) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-green-50">
          <Bell size={40} color="#16a34a" />
        </View>
        <Text className="mt-4 font-display text-lg text-gray-800">
          Connecte-toi pour voir tes notifications
        </Text>
        <Text className="mt-1 text-center font-body text-gray-500">
          Tu seras notifié ici du suivi de tes commandes et livraisons.
        </Text>
        <Pressable
          onPress={() => router.replace("/compte")}
          accessibilityRole="button"
          className="mt-6 h-12 items-center justify-center rounded-2xl bg-brand px-6 active:opacity-80"
        >
          <Text className="font-display-semibold text-white">Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          headerRight: () =>
            unreadCount > 0 ? (
              <Pressable
                onPress={() => markAllAsRead()}
                hitSlop={8}
                accessibilityRole="button"
                className="mr-3"
              >
                <Text className="font-body-semibold text-sm text-brand">Tout lire</Text>
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerClassName="p-3"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPressNotif(item)}
            accessibilityRole="button"
            className={`mb-2 flex-row rounded-2xl border bg-white p-4 active:opacity-80 ${
              item.read ? "border-gray-100" : "border-green-200"
            }`}
          >
            <View
              className={`h-10 w-10 items-center justify-center rounded-xl ${
                item.read ? "bg-gray-100" : "bg-green-100"
              }`}
            >
              {(ICONS[item.type] ?? ICONS.general)(item.read ? "#9CA3AF" : "#16a34a")}
            </View>
            <View className="ml-3 flex-1">
              <Text
                numberOfLines={1}
                className={item.read ? "font-body-semibold text-gray-700" : "font-display text-gray-900"}
              >
                {item.title}
              </Text>
              <Text numberOfLines={2} className="mt-0.5 font-body text-xs text-gray-500">
                {item.message}
              </Text>
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-[10px] font-bold uppercase text-gray-400">
                  {timeAgo(item.createdAt)}
                </Text>
                <View className="flex-row items-center gap-3">
                  {!!item.orderId && <Text className="text-[10px] font-bold text-brand">Détails →</Text>}
                  <Pressable
                    onPress={() => deleteNotification(item.id)}
                    hitSlop={8}
                    accessibilityLabel="Supprimer la notification"
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            </View>
            {!item.read && <View className="absolute right-3 top-3 h-2 w-2 rounded-full bg-green-500" />}
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="mt-16 items-center px-8">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-green-50">
              <Bell size={40} color="#16a34a" />
            </View>
            <Text className="mt-4 font-display text-lg text-gray-800">Aucune notification</Text>
            <Text className="mt-1 text-center font-body text-gray-500">
              Tu seras notifié ici du suivi de tes commandes.
            </Text>
          </View>
        }
      />
    </View>
  );
}
