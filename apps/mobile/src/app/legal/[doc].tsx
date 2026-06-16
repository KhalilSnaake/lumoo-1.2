import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { getLegalDoc } from "@lumoo/core";

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const data = getLegalDoc(typeof doc === "string" ? doc : undefined);

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Stack.Screen options={{ title: "Informations légales" }} />
        <Text className="font-body text-gray-500">Document introuvable.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="px-5 py-6">
      <Stack.Screen options={{ title: data.title }} />
      <Text className="font-display text-2xl text-ink">{data.title}</Text>

      <View className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
        <Text className="font-body text-xs leading-5 text-amber-800">
          ⚖️ Modèle à faire valider par un juriste. Les éléments entre crochets […] sont à compléter.
        </Text>
      </View>

      {data.intro ? (
        <Text className="mt-4 font-body text-sm leading-6 text-gray-700">{data.intro}</Text>
      ) : null}

      {data.sections.map((s) => (
        <View key={s.heading} className="mt-5">
          <Text className="font-display-semibold text-base text-ink">{s.heading}</Text>
          {s.paragraphs.map((para, i) => (
            <Text key={i} className="mt-1.5 font-body text-sm leading-6 text-gray-700">
              {para}
            </Text>
          ))}
        </View>
      ))}

      <View className="h-16" />
    </ScrollView>
  );
}
