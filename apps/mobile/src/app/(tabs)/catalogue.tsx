import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Search, X } from "lucide-react-native";
import { useCategories, useProducts } from "@lumoo/core";
import { ProductCard } from "@/components/product-card";
import { HomeBanner } from "@/components/ad-banner";

export default function CatalogueScreen() {
  const { products, loading } = useProducts();
  const { categories } = useCategories();
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    return products
      .filter((p) => p.published !== false)
      .filter((p) => {
        const matchesCategory =
          selected == null
            ? true
            : p.category_id === selected ||
              (typeof p.category === "object" && p.category?.id === selected);
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q);
        return matchesCategory && matchesSearch;
      });
  }, [products, selected, q]);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white">
        <View className="px-3 pt-3">
          <View className="min-h-12 flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 px-3">
            <Search size={18} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher un produit…"
              placeholderTextColor="#9CA3AF"
              accessibilityLabel="Rechercher un produit"
              returnKeyType="search"
              className="flex-1 px-2 py-2.5 font-body text-gray-900"
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => setSearch("")}
                hitSlop={10}
                accessibilityLabel="Effacer la recherche"
              >
                <X size={18} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-3 py-3"
        >
          <Chip label="Tous" active={selected == null} onPress={() => setSelected(null)} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              active={selected === c.id}
              onPress={() => setSelected(c.id)}
            />
          ))}
        </ScrollView>
      </View>

      {loading && products.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#16a34a" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => String(p.id)}
          numColumns={2}
          contentContainerClassName="px-2 pb-8 pt-2"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <View className="px-2 pb-3">
              <HomeBanner />
            </View>
          }
          renderItem={({ item }) => <ProductCard product={item} />}
          ListEmptyComponent={
            <View className="mt-12 items-center px-8">
              <Search size={40} color="#D1D5DB" />
              <Text className="mt-3 text-center font-body text-gray-400">
                {q
                  ? `Aucun produit pour « ${search.trim()} ».`
                  : "Aucun produit dans cette catégorie."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`min-h-11 justify-center rounded-full px-4 ${
        active ? "bg-brand" : "bg-gray-100"
      }`}
    >
      <Text className={`font-body-semibold ${active ? "text-white" : "text-gray-700"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
