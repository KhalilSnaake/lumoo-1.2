import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import { useNotifications } from "@lumoo/core";

export function NotificationBell() {
  const { unreadCount } = useNotifications();

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : "Notifications"
      }
      className="mr-3 h-9 w-9 items-center justify-center"
    >
      <Bell size={22} color="#16a34a" />
      {unreadCount > 0 && (
        <View className="absolute -right-0.5 -top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1">
          <Text className="text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
