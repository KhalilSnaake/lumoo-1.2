import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Mail, MessageCircle, Phone } from "lucide-react-native";
import { getSupabase, useAuth } from "@lumoo/core";
import { MaliPhoneInput } from "@/components/MaliPhoneInput";
import { useToast } from "@/context/ToastContext";

const SUBJECTS = [
  { key: "question", label: "Question produit" },
  { key: "commande", label: "Suivi de commande" },
  { key: "partenariat", label: "Partenariat" },
  { key: "support", label: "Support" },
  { key: "autre", label: "Autre" },
];

const PHONE = "+22377996858";
const EMAIL = "contact@lumoo.ml";
const WHATSAPP = "https://wa.me/22377996858";

export default function ContactScreen() {
  const { user } = useAuth();
  const { show } = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Renseigne ton nom, ton email et ton message.");
      return;
    }
    setLoading(true);
    try {
      const { error: e } = await getSupabase()
        .from("contact_messages")
        .insert([
          {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            subject,
            message: message.trim(),
            created_at: new Date().toISOString(),
          },
        ]);
      if (e) throw e;
      show("Message envoyé. On te répond vite !");
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="p-5 pb-10"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Text className="font-body text-gray-500">
          Une question, un souci ? Écris-nous, on te répond vite.
        </Text>

        <View className="mt-5">
          <Text className="mb-1 ml-1 font-body-semibold text-xs text-gray-500">Nom complet *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ton nom"
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="Nom complet"
            className="min-h-12 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-body text-gray-900"
          />
        </View>

        <View className="mt-3">
          <Text className="mb-1 ml-1 font-body-semibold text-xs text-gray-500">Email *</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="ton@email.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel="Email"
            className="min-h-12 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-body text-gray-900"
          />
        </View>

        <View className="mt-3">
          <MaliPhoneInput value={phone} onChange={setPhone} label="Téléphone (optionnel)" />
        </View>

        <Text className="mb-2 ml-1 mt-4 font-body-semibold text-xs text-gray-500">Sujet</Text>
        <View className="flex-row flex-wrap gap-2">
          {SUBJECTS.map((s) => {
            const active = subject === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSubject(active ? "" : s.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`min-h-9 justify-center rounded-full px-3 ${active ? "bg-brand" : "bg-gray-100"}`}
              >
                <Text className={`font-body-semibold text-xs ${active ? "text-white" : "text-gray-600"}`}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-4">
          <Text className="mb-1 ml-1 font-body-semibold text-xs text-gray-500">Message *</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Écris ton message…"
            placeholderTextColor="#9CA3AF"
            multiline
            style={{ textAlignVertical: "top" }}
            accessibilityLabel="Message"
            className="min-h-28 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-body text-gray-900"
          />
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
          className={`mt-5 h-12 items-center justify-center rounded-2xl bg-brand active:opacity-80 ${
            loading ? "opacity-60" : ""
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="font-display-semibold text-white">Envoyer le message</Text>
          )}
        </Pressable>

        <Text className="mb-2 ml-1 mt-8 text-xs font-bold uppercase tracking-wider text-gray-400">
          Ou directement
        </Text>
        <View className="overflow-hidden rounded-3xl bg-white">
          <ContactRow
            icon={<Phone size={18} color="#16a34a" />}
            label={PHONE}
            onPress={() => Linking.openURL(`tel:${PHONE}`)}
          />
          <View className="ml-14 h-px bg-gray-100" />
          <ContactRow
            icon={<Mail size={18} color="#16a34a" />}
            label={EMAIL}
            onPress={() => Linking.openURL(`mailto:${EMAIL}`)}
          />
          <View className="ml-14 h-px bg-gray-100" />
          <ContactRow
            icon={<MessageCircle size={18} color="#16a34a" />}
            label="WhatsApp"
            onPress={() => Linking.openURL(WHATSAPP)}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ContactRow({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-12 flex-row items-center px-4 active:bg-gray-50"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-green-50">{icon}</View>
      <Text className="ml-3 font-body-semibold text-gray-700">{label}</Text>
    </Pressable>
  );
}
