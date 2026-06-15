import { View, Text, TextInput } from "react-native";

export function MaliPhoneInput({
  value,
  onChange,
  label,
  placeholder = "77 99 68 58",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const digits = value.replace("+223 ", "").replace(/\s/g, "").slice(0, 8);
  const handle = (t: string) => {
    const d = t.replace(/\D/g, "").slice(0, 8);
    onChange(d ? `+223 ${d}` : "");
  };
  return (
    <View>
      {label ? (
        <Text className="mb-1 ml-1 font-body-semibold text-xs text-muted">{label}</Text>
      ) : null}
      <View className="min-h-12 flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 px-3">
        <View className="h-4 w-6 flex-row overflow-hidden rounded-sm">
          <View className="flex-1 bg-mali-green" />
          <View className="flex-1 bg-mali-yellow" />
          <View className="flex-1 bg-mali-red" />
        </View>
        <Text className="ml-2 mr-2 border-r border-gray-200 pr-2 font-display text-sm text-muted">+223</Text>
        <TextInput
          value={digits}
          onChangeText={handle}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
          maxLength={8}
          accessibilityLabel={label ?? "Téléphone"}
          className="flex-1 py-3 font-body text-gray-900"
        />
        <Text className="ml-2 font-body text-[10px] text-gray-300">{digits.length}/8</Text>
      </View>
    </View>
  );
}
