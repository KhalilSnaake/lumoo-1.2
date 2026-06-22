import { FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react-native";
import { router } from "expo-router";
import { useCart } from "@lumoo/core";
import { HomeBanner } from "@/components/ad-banner";

function formatFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

export default function PanierScreen() {
  const { items, updateQuantity, removeFromCart, totalPrice, totalItems } = useCart();

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-gray-50">
        <View className="p-3">
          <HomeBanner />
        </View>
        <View className="flex-1 items-center justify-center px-8 pb-16">
          <ShoppingBag size={56} color="#9CA3AF" />
          <Text className="mt-4 font-display text-lg text-gray-700">Votre panier est vide</Text>
          <Text className="mt-1 text-center font-body text-gray-500">
            Ajoutez des produits depuis l&apos;accueil ou l&apos;onglet Produits.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.product.id)}
        contentContainerClassName="p-3"
        ListHeaderComponent={
          <View className="mb-3">
            <HomeBanner />
          </View>
        }
        renderItem={({ item }) => (
          <View className="mb-3 flex-row items-center rounded-2xl border border-gray-100 bg-white p-3">
            <Image
              source={item.product.image_url ? { uri: item.product.image_url } : undefined}
              contentFit="cover"
              cachePolicy="memory-disk"
              style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "#F0F0F3" }}
            />
            <View className="ml-3 flex-1">
              <Text numberOfLines={1} className="font-display text-gray-800">
                {item.product.name}
              </Text>
              <Text className="mt-0.5 font-display text-brand">
                {formatFCFA(item.product.price)}
              </Text>
              <View className="mt-2 flex-row items-center">
                <Pressable
                  onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                  hitSlop={8}
                  accessibilityLabel="Diminuer la quantité"
                  className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 active:opacity-70"
                >
                  <Minus size={16} color="#374151" />
                </Pressable>
                <Text className="mx-3 min-w-6 text-center font-body-semibold text-gray-800">
                  {item.quantity}
                </Text>
                <Pressable
                  onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
                  hitSlop={8}
                  accessibilityLabel="Augmenter la quantité"
                  className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 active:opacity-70"
                >
                  <Plus size={16} color="#374151" />
                </Pressable>
              </View>
            </View>
            <Pressable
              onPress={() => removeFromCart(item.product.id)}
              hitSlop={8}
              accessibilityLabel={`Retirer ${item.product.name}`}
              className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
            >
              <Trash2 size={20} color="#EF4444" />
            </Pressable>
          </View>
        )}
      />

      <View className="border-t border-gray-100 bg-white p-4 pb-6">
        <View className="flex-row items-center justify-between">
          <Text className="font-body text-gray-500">
            Total ({totalItems} article{totalItems > 1 ? "s" : ""})
          </Text>
          <Text className="font-display text-xl text-gray-900">{formatFCFA(totalPrice)}</Text>
        </View>
        <Pressable
          onPress={() => router.push("/checkout")}
          accessibilityRole="button"
          className="mt-3 h-12 items-center justify-center rounded-2xl bg-brand active:opacity-80"
        >
          <Text className="font-display-semibold text-white">Commander</Text>
        </Pressable>
      </View>
    </View>
  );
}
