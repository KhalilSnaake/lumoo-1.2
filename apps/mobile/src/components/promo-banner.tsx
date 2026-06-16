import { Image } from "expo-image";
import { View } from "react-native";

const BANNER = require("../../assets/images/lumoo-banner.png");
const RATIO = 1734 / 907; // ratio natif de l'image ≈ 1.91

export function PromoBanner({ rounded = true }: { rounded?: boolean }) {
  return (
    <View className={rounded ? "overflow-hidden rounded-3xl border border-gray-100 bg-white" : "bg-white"}>
      <Image
        source={BANNER}
        style={{ width: "100%", aspectRatio: RATIO }}
        contentFit="cover"
        cachePolicy="memory-disk"
        accessibilityLabel="Lumoo, votre marché en ligne — livraison rapide à Bamako et environs"
      />
    </View>
  );
}
