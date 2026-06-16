import { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, View, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useAds, type Ad, type AdPosition } from "@lumoo/core";
import { PromoBanner } from "./promo-banner";

// Largeur estimée du bandeau (Accueil : px-2 du contentContainer + px-2 du header = 16 de chaque côté).
const INITIAL_WIDTH = Dimensions.get("window").width - 32;

function openAd(linkUrl?: string) {
  if (linkUrl) Linking.openURL(linkUrl).catch(() => {});
}

function AdSlide({ ad, width, rounded = true }: { ad: Ad; width?: number; rounded?: boolean }) {
  // Ratio par défaut le temps du chargement, puis on prend le ratio réel de
  // l'image pour l'afficher EN ENTIER (aucune coupe).
  const [ratio, setRatio] = useState(3);
  return (
    <Pressable
      onPress={() => openAd(ad.link_url)}
      disabled={!ad.link_url}
      accessibilityRole={ad.link_url ? "link" : "image"}
      accessibilityLabel={ad.title}
      style={width ? { width } : undefined}
      className={
        rounded
          ? "overflow-hidden rounded-3xl border border-gray-100 bg-white active:opacity-90"
          : "bg-white active:opacity-90"
      }
    >
      <Image
        source={{ uri: ad.image_url }}
        style={{ width: "100%", aspectRatio: ratio }}
        contentFit="cover"
        cachePolicy="memory-disk"
        accessibilityLabel={ad.title}
        onLoad={(e) => {
          const w = e.source?.width;
          const h = e.source?.height;
          if (w && h) setRatio(w / h);
        }}
      />
    </Pressable>
  );
}

function AdCarousel({ ads, rounded }: { ads: Ad[]; rounded?: boolean }) {
  const [width, setWidth] = useState(INITIAL_WIDTH);
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList<Ad>>(null);

  useEffect(() => {
    if (width === 0 || ads.length < 2) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % ads.length;
        ref.current?.scrollToOffset({ offset: next * width, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [width, ads.length]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  };

  return (
    <View onLayout={onLayout}>
      <FlatList
        ref={ref}
        data={ads}
        keyExtractor={(a) => a.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        renderItem={({ item }) => <AdSlide ad={item} width={width} rounded={rounded} />}
      />
      <View className="mt-2 flex-row items-center justify-center gap-1.5">
        {ads.map((a, i) => (
          <View
            key={a.id}
            className={`h-1.5 rounded-full ${i === index ? "w-4 bg-brand" : "w-1.5 bg-gray-300"}`}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Bandeau d'Accueil : affiche les pubs actives (carrousel auto-défilant si plusieurs),
 * et retombe sur le PromoBanner Lumoo statique s'il n'y a aucune pub active.
 */
export function HomeBanner({
  position = "top",
  rounded = true,
}: {
  position?: AdPosition;
  rounded?: boolean;
}) {
  const { ads } = useAds();
  const active = ads.filter((a) => a.active && Boolean(a.image_url));
  const matched = active.filter((a) => a.position === position);
  const display = matched.length > 0 ? matched : active;

  if (display.length === 0) return <PromoBanner rounded={rounded} />;
  if (display.length === 1) return <AdSlide ad={display[0]} rounded={rounded} />;
  return <AdCarousel ads={display} rounded={rounded} />;
}
