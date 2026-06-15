import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { getSupabase } from "@lumoo/core";

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        setHasSession(!!data.session);
        setChecking(false);
      });
  }, []);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw new Error(upErr.message);
      await supabase.auth.signOut();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color="#16a34a" />
      </View>
    );
  }

  if (!hasSession && !done) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8" style={{ paddingTop: insets.top }}>
        <Text className="text-6xl">⏰</Text>
        <Text className="mt-4 font-display text-xl text-ink">Lien invalide ou expiré</Text>
        <Text className="mt-1 text-center font-body text-gray-500">Demande un nouveau lien de réinitialisation.</Text>
        <Pressable onPress={() => router.replace("/(tabs)/compte")} accessibilityRole="button" className="mt-6 h-12 w-full items-center justify-center rounded-2xl bg-brand active:opacity-80">
          <Text className="font-display-semibold text-white">Demander un nouveau lien</Text>
        </Pressable>
      </View>
    );
  }

  if (done) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8" style={{ paddingTop: insets.top }}>
        <Text className="text-6xl">✅</Text>
        <Text className="mt-4 font-display text-xl text-ink">Mot de passe modifié</Text>
        <Text className="mt-1 text-center font-body text-gray-500">Connecte-toi avec ton nouveau mot de passe.</Text>
        <Pressable onPress={() => router.replace("/(tabs)/compte")} accessibilityRole="button" className="mt-6 h-12 w-full items-center justify-center rounded-2xl bg-brand active:opacity-80">
          <Text className="font-display-semibold text-white">Aller à la connexion</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 px-6" style={{ paddingTop: insets.top + 24 }}>
      <Text className="font-display text-2xl text-ink">Nouveau mot de passe</Text>
      <Text className="mt-1 font-body text-gray-500">Choisis un nouveau mot de passe (6 caractères minimum).</Text>
      <View className="mt-6 gap-3">
        <TextInput value={password} onChangeText={setPassword} placeholder="Nouveau mot de passe" placeholderTextColor="#9CA3AF" secureTextEntry autoCapitalize="none" accessibilityLabel="Nouveau mot de passe" className="min-h-12 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-body text-gray-900" />
        <TextInput value={confirm} onChangeText={setConfirm} placeholder="Confirmer le mot de passe" placeholderTextColor="#9CA3AF" secureTextEntry autoCapitalize="none" accessibilityLabel="Confirmer le mot de passe" className="min-h-12 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-body text-gray-900" />
        {error ? <Text className="font-body text-sm text-red-600">{error}</Text> : null}
        <Pressable onPress={submit} disabled={loading} accessibilityRole="button" className={`mt-2 h-12 items-center justify-center rounded-2xl bg-brand active:opacity-80 ${loading ? "opacity-60" : ""}`}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text className="font-display-semibold text-white">Mettre à jour</Text>}
        </Pressable>
      </View>
    </View>
  );
}
