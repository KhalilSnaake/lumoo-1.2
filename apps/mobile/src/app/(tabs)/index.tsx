import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Search, X } from "lucide-react-native";
import { apiGetProductsPage, type Product } from "@lumoo/core";
import { ProductCard } from "@/components/product-card";
import { HomeBanner } from "@/components/ad-banner";

const PAGE_SIZE = 20;

export default function AccueilScreen() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce de la recherche (évite une requête par frappe)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // (Re)charge la page 0 au démarrage et à chaque changement de recherche.
  // Populaires d'abord, puis les plus récents.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGetProductsPage({ page: 0, pageSize: PAGE_SIZE, popularFirst: true, search: debouncedSearch })
      .then((res) => {
        if (cancelled) return;
        setItems(res.products);
        setHasMore(res.hasMore);
        setPage(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  // Scroll infini : charge la page suivante quand on approche du bas
  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    const next = page + 1;
    setLoadingMore(true);
    apiGetProductsPage({ page: next, pageSize: PAGE_SIZE, popularFirst: true, search: debouncedSearch })
      .then((res) => {
        setItems((prev) => [...prev, ...res.products]);
        setHasMore(res.hasMore);
        setPage(next);
      })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, loading, hasMore, page, debouncedSearch]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Barre de recherche fixe (hors liste → reste visible pendant le scroll) */}
      <View className="border-b border-gray-100 bg-white px-3 py-3">
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
            <Pressable onPress={() => setSearch("")} hitSlop={10} accessibilityLabel="Effacer la recherche">
              <X size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </View>

      {loading && items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#16a34a" />
          <Text className="mt-2 font-body text-gray-500">Chargement des produits…</Text>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={items}
          keyExtractor={(p) => String(p.id)}
          numColumns={2}
          contentContainerClassName="px-2 pb-8"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            debouncedSearch ? (
              // En recherche : pas de bannière → les résultats remontent en haut (au-dessus du clavier)
              <View className="px-2 pb-1 pt-3">
                <Text className="font-body text-gray-500">Résultats pour « {debouncedSearch} »</Text>
              </View>
            ) : (
              <View className="px-2 pt-4">
                <HomeBanner />
                <Text className="mt-4 font-display text-2xl text-gray-900">Bienvenue</Text>
                <Text className="mt-1 font-body text-gray-500">Découvrez tous nos produits</Text>
              </View>
            )
          }
          renderItem={({ item }) => <ProductCard product={item} />}
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4">
                <ActivityIndicator color="#16a34a" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="mt-12 items-center px-8">
              <Search size={40} color="#D1D5DB" />
              <Text className="mt-3 text-center font-body text-gray-400">
                {debouncedSearch
                  ? `Aucun produit pour « ${debouncedSearch} ».`
                  : "Aucun produit."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
