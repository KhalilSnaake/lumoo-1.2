import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react-native";
import { useCart, useProducts } from "@lumoo/core";
import { useToast } from "@/context/ToastContext";

function formatFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products } = useProducts();
  const { addToCart, items } = useCart();
  const { show } = useToast();
  const insets = useSafeAreaInsets();

  const product = useMemo(
    () => products.find((p) => String(p.id) === String(id)),
    [products, id],
  );

  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Stack.Screen options={{ title: "Produit" }} />
        <Text className="text-center font-body text-gray-400">Produit introuvable.</Text>
      </View>
    );
  }

  const inStock = product.inStock !== false && (product.stock_quantity ?? 0) !== 0;
  const maxQty =
    product.stock_quantity && product.stock_quantity > 0 ? product.stock_quantity : 99;
  const categoryName =
    product.category && typeof product.category === "object" ? product.category.name : undefined;
  const inCart = items.find((it) => it.product.id === product.id)?.quantity ?? 0;

  function addToCartHandler() {
    if (!product) return;
    for (let i = 0; i < qty; i += 1) addToCart(product);
    setAdded(true);
    show(`${qty} × ${product.name} ajouté au panier`);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: product.name }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Image
          source={product.image_url ? { uri: product.image_url } : undefined}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          accessibilityLabel={product.name}
          style={{ width: "100%", aspectRatio: 1, backgroundColor: "#F0F0F3" }}
        />

        <View className="p-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="font-display text-2xl text-gray-900">{product.name}</Text>
              {!!product.unit && (
                <Text className="mt-0.5 font-body text-gray-400">{product.unit}</Text>
              )}
            </View>
            {inStock ? (
              <View className="rounded-full bg-green-100 px-3 py-1">
                <Text className="text-xs font-bold text-green-700">En stock</Text>
              </View>
            ) : (
              <View className="rounded-full bg-red-100 px-3 py-1">
                <Text className="text-xs font-bold text-red-700">Rupture</Text>
              </View>
            )}
          </View>

          <Text className="mt-3 font-display text-2xl text-brand">{formatFCFA(product.price)}</Text>

          {inCart > 0 && (
            <View className="mt-3 flex-row items-center gap-1.5 self-start rounded-full bg-green-100 px-3 py-1">
              <ShoppingCart size={14} color="#16a34a" />
              <Text className="font-body-semibold text-xs text-green-700">
                {inCart} déjà dans votre panier
              </Text>
            </View>
          )}

          {!!categoryName && (
            <View className="mt-3 self-start rounded-full bg-gray-100 px-3 py-1">
              <Text className="font-body-semibold text-xs text-gray-600">{categoryName}</Text>
            </View>
          )}

          {!!product.description && (
            <Text className="mt-4 font-body leading-6 text-gray-600">{product.description}</Text>
          )}
        </View>
      </ScrollView>

      {/* Barre d'action sticky */}
      <View
        style={{ paddingBottom: insets.bottom + 12 }}
        className="flex-row items-center gap-3 border-t border-gray-100 bg-white px-4 pt-3"
      >
        <View className="flex-row items-center rounded-2xl bg-gray-100 p-1">
          <Pressable
            onPress={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            hitSlop={6}
            accessibilityLabel="Diminuer la quantité"
            className={`h-10 w-10 items-center justify-center rounded-xl ${qty <= 1 ? "opacity-40" : "active:opacity-70"}`}
          >
            <Minus size={18} color="#374151" />
          </Pressable>
          <Text className="mx-2 min-w-6 text-center font-display text-gray-900">{qty}</Text>
          <Pressable
            onPress={() => setQty((q) => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty}
            hitSlop={6}
            accessibilityLabel="Augmenter la quantité"
            className={`h-10 w-10 items-center justify-center rounded-xl ${qty >= maxQty ? "opacity-40" : "active:opacity-70"}`}
          >
            <Plus size={18} color="#374151" />
          </Pressable>
        </View>

        <Pressable
          onPress={addToCartHandler}
          disabled={!inStock}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter ${qty} ${product.name} au panier`}
          className={`h-12 flex-1 flex-row items-center justify-center rounded-2xl ${
            inStock ? "bg-brand active:opacity-80" : "bg-gray-300"
          }`}
        >
          {!inStock ? (
            <Text className="font-display-semibold text-white">Indisponible</Text>
          ) : added ? (
            <>
              <Check size={18} color="#ffffff" />
              <Text className="ml-2 font-display-semibold text-white">Ajouté</Text>
            </>
          ) : (
            <Text className="font-display-semibold text-white">
              Ajouter · {formatFCFA(product.price * qty)}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
