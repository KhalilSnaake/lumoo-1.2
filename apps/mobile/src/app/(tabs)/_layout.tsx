import { Tabs, router } from "expo-router";
import { Pressable, View } from "react-native";
import { Home, LayoutGrid, MessageCircle, Package, ShoppingCart, User } from "lucide-react-native";
import { useCart } from "@lumoo/core";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/notification-bell";

const BRAND = "#16a34a";
const INACTIVE = "#9CA3AF";

export default function TabsLayout() {
  const { totalItems } = useCart();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: BRAND,
        headerTitleStyle: { fontWeight: "800", color: BRAND },
        headerRight: () => (
          <View className="flex-row items-center">
            <Pressable
              onPress={() => router.push("/contact")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Nous contacter"
              className="mr-1 h-9 w-9 items-center justify-center"
            >
              <MessageCircle size={22} color="#16a34a" />
            </Pressable>
            <NotificationBell />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          headerTitle: () => <Logo width={112} />,
          headerTitleAlign: "left",
          headerStyle: { backgroundColor: "#ffffff" },
          headerTintColor: "#111827",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{
          title: "Catalogue",
          tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="panier"
        options={{
          title: "Panier",
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />,
          tabBarBadge: totalItems > 0 ? totalItems : undefined,
          tabBarBadgeStyle: { backgroundColor: "#EF4444", color: "#ffffff" },
        }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          title: "Commandes",
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{
          title: "Compte",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
