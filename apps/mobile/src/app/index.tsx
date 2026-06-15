import { FlatList, Text, View, ActivityIndicator } from "react-native";
import { useProducts } from "@lumoo/core";

export default function HomeScreen() {
  const { products, loading } = useProducts();

  if (loading && products.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
        <Text className="mt-2 text-gray-500">Chargement des produits…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Text className="px-4 pt-4 pb-2 text-xl font-extrabold text-gray-800">
        Produits ({products.length})
      </Text>
      <FlatList
        data={products}
        keyExtractor={(p) => String(p.id)}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => (
          <View className="mb-3 rounded-2xl bg-white p-4 border border-gray-100">
            <Text className="font-bold text-gray-800">{item.name}</Text>
            <Text className="text-brand font-extrabold mt-1">
              {item.price.toLocaleString("fr-FR")} FCFA
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-gray-400 text-center mt-8">Aucun produit.</Text>
        }
      />
    </View>
  );
}
