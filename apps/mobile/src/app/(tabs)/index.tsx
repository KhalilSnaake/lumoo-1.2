import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useProducts } from "@lumoo/core";
import { ProductCard } from "@/components/product-card";
import { HomeBanner } from "@/components/ad-banner";

export default function AccueilScreen() {
  const { products, loading } = useProducts();

  const popular = products.filter((p) => p.is_popular);
  const data = popular.length > 0 ? popular : products;

  if (loading && products.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color="#16a34a" />
        <Text className="mt-2 text-gray-500">Chargement des produits…</Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-gray-50"
      data={data}
      keyExtractor={(p) => String(p.id)}
      numColumns={2}
      contentContainerClassName="px-2 pb-8"
      ListHeaderComponent={
        <View className="px-2 pt-4">
          <HomeBanner />
          <Text className="mt-4 font-display text-2xl text-gray-900">Bienvenue</Text>
          <Text className="mt-1 font-body text-gray-500">
            {popular.length > 0 ? "Nos produits populaires" : "Découvrez nos produits"}
          </Text>
        </View>
      }
      renderItem={({ item }) => <ProductCard product={item} />}
      ListEmptyComponent={
        <Text className="mt-8 text-center text-gray-400">Aucun produit.</Text>
      }
    />
  );
}
