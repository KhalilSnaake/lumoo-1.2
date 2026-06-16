import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Eye, EyeOff, Lock } from "lucide-react-native";
import { useAuth } from "@lumoo/core";
import { useToast } from "@/context/ToastContext";

export default function ChangePasswordScreen() {
  const { updateOwnPassword } = useAuth();
  const { show } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await updateOwnPassword(password);
      show("Mot de passe modifié");
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
        <Text className="font-body text-gray-500">
          Choisis un nouveau mot de passe pour ton compte Lumoo.
        </Text>

        <View className="mt-5">
          <Text className="mb-1 ml-1 font-body-semibold text-xs text-gray-500">Nouveau mot de passe</Text>
          <View className="min-h-12 flex-row items-center rounded-2xl border border-gray-200 bg-white px-3">
            <Lock size={18} color="#9CA3AF" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!reveal}
              autoCapitalize="none"
              accessibilityLabel="Nouveau mot de passe"
              className="flex-1 px-2 py-3 font-body text-gray-900"
            />
            <Pressable
              onPress={() => setReveal((r) => !r)}
              hitSlop={10}
              accessibilityLabel={reveal ? "Masquer" : "Afficher"}
            >
              {reveal ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
            </Pressable>
          </View>
        </View>

        <View className="mt-3">
          <Text className="mb-1 ml-1 font-body-semibold text-xs text-gray-500">Confirmer</Text>
          <View className="min-h-12 flex-row items-center rounded-2xl border border-gray-200 bg-white px-3">
            <Lock size={18} color="#9CA3AF" />
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!reveal}
              autoCapitalize="none"
              accessibilityLabel="Confirmer le mot de passe"
              className="flex-1 px-2 py-3 font-body text-gray-900"
            />
          </View>
        </View>

        {!!error && (
          <Text accessibilityRole="alert" className="mt-3 ml-1 font-body-semibold text-red-600">
            {error}
          </Text>
        )}

        <Pressable
          onPress={submit}
          disabled={loading}
          accessibilityRole="button"
          className={`mt-6 h-12 items-center justify-center rounded-2xl bg-brand active:opacity-80 ${
            loading ? "opacity-60" : ""
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="font-display-semibold text-white">Enregistrer</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
