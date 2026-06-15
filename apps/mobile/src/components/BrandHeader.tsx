import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "./Logo";

export function BrandHeader({ title }: { title?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="bg-surface px-4 pb-3 border-b border-line"
    >
      <View className="flex-row items-center justify-between">
        <Logo width={110} />
      </View>
      {title ? (
        <Text className="mt-2 font-display text-2xl text-ink">{title}</Text>
      ) : null}
    </View>
  );
}
