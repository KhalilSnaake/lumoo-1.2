import { useState } from "react";
import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { ChevronDown, Check } from "lucide-react-native";

export const CITIES = [
  "Bamako", "Sikasso", "Kayes", "Ségou", "Mopti", "Gao", "Tombouctou", "Koulikoro",
] as const;

export function CityPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choisir la ville de livraison"
        className="min-h-12 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4"
      >
        <Text className={`font-body ${value ? "text-gray-900" : "text-gray-400"}`}>
          {value || "Sélectionner une ville"}
        </Text>
        <ChevronDown size={18} color="#9CA3AF" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} className="flex-1 justify-end bg-black/40">
          <Pressable className="rounded-t-3xl bg-white pb-8 pt-2">
            <View className="mx-auto my-2 h-1 w-10 rounded-full bg-gray-200" />
            <Text className="px-5 py-2 font-display text-lg text-ink">Choisir la ville</Text>
            <FlatList
              data={CITIES as readonly string[]}
              keyExtractor={(c) => c}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  className="min-h-12 flex-row items-center justify-between px-5 active:bg-gray-50"
                >
                  <Text className="font-body text-gray-800">{item}</Text>
                  {value === item ? <Check size={18} color="#16a34a" /> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
