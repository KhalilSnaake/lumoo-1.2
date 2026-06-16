import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { useCart, type Product } from "@lumoo/core";
import { useToast } from "@/context/ToastContext";

function formatFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function ProductCardBase({ product }: { product: Product }) {
  const { addToCart, items } = useCart();
  const { show } = useToast();
  const inCart = items.find((it) => it.product.id === product.id)?.quantity ?? 0;

  return (
    <View className="m-2 flex-1 overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <Pressable
        onPress={() => router.push(`/produit/${product.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Voir ${product.name}`}
      >
        <Image
          source={product.image_url ? { uri: product.image_url } : undefined}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          style={{ width: "100%", aspectRatio: 1, backgroundColor: "#F0F0F3" }}
        />
        {inCart > 0 && (
          <View
            pointerEvents="none"
            className="absolute right-2 top-2 h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5"
            style={{ shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 }}
          >
            <Text className="text-xs font-bold text-white">{inCart}</Text>
          </View>
        )}
        <View className="px-3 pt-3">
          <Text numberOfLines={1} className="font-display text-gray-800">
            {product.name}
          </Text>
          {!!product.unit && (
            <Text className="mt-0.5 font-body text-xs text-gray-400">{product.unit}</Text>
          )}
        </View>
      </Pressable>
      <View className="flex-row items-center justify-between px-3 pb-3 pt-2">
        <Text className="font-display text-brand">{formatFCFA(product.price)}</Text>
        <Pressable
          onPress={() => {
            addToCart(product);
            show(`${product.name} ajouté au panier`);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter ${product.name} au panier`}
          className="h-11 w-11 items-center justify-center rounded-full bg-brand active:opacity-80"
        >
          <Plus size={20} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

export const ProductCard = memo(ProductCardBase);
