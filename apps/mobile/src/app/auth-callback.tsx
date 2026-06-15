import { View, ActivityIndicator } from "react-native";

export default function AuthCallbackScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50">
      <ActivityIndicator color="#16a34a" />
    </View>
  );
}
