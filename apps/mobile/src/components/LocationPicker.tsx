import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { MapPin } from "lucide-react-native";
import * as Location from "expo-location";

export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const has = lat != null && lng != null;

  const getLocation = async () => {
    setError(null);
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Autorise l'accès à la localisation pour partager ta position.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      onChange(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setError("Impossible de récupérer la position. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Pressable
        onPress={getLocation}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Partager ma position GPS"
        className={`min-h-12 flex-row items-center justify-center gap-2 rounded-2xl border px-4 active:opacity-80 ${
          has ? "border-brand bg-green-50" : "border-gray-200 bg-gray-50"
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#16a34a" />
        ) : (
          <MapPin size={18} color={has ? "#16a34a" : "#6B7280"} />
        )}
        <Text className={`font-body-semibold ${has ? "text-brand" : "text-gray-600"}`}>
          {has ? "Position partagée ✓" : "Partager ma position GPS"}
        </Text>
      </Pressable>
      {has ? (
        <Text className="mt-1 text-center font-body text-[10px] text-gray-400">
          {lat!.toFixed(4)}, {lng!.toFixed(4)}
        </Text>
      ) : null}
      {error ? (
        <Text className="mt-1 text-center font-body text-xs text-red-600">{error}</Text>
      ) : null}
    </View>
  );
}
