import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, LogOut, Package, Pencil, Truck } from "lucide-react-native";
import { useAuth } from "@lumoo/core";
import { MaliPhoneInput } from "@/components/MaliPhoneInput";
import { CityPicker } from "@/components/CityPicker";

const ROLE_LABELS: Record<string, string> = {
  client: "Client",
  livreur: "Livreur",
  admin: "Admin",
};

const CARD_SHADOW = {
  shadowColor: "#0F172A",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

export function AccountProfile() {
  const { user, logout, updateUser } = useAuth();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  const startEdit = () => {
    setEditName(user.name || "");
    setEditPhone(user.phone || "");
    setEditAddress(user.address || "");
    setEditCity(user.city || "");
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!editName.trim() || !editPhone.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await updateUser(user.id, { name: editName.trim(), phone: editPhone.trim(), address: editAddress.trim(), city: editCity });
      if (res) setEditing(false);
      else setError("La mise à jour a échoué. Réessaie.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="px-5 pt-6 pb-10" keyboardShouldPersistTaps="handled">
      {/* Carte profil */}
      <View className="flex-row items-center rounded-3xl bg-white p-5" style={CARD_SHADOW}>
        <View className="h-16 w-16 items-center justify-center rounded-full bg-brand">
          <Text className="font-display text-2xl text-white">{initial}</Text>
        </View>
        <View className="ml-4 flex-1">
          <Text numberOfLines={1} className="font-display text-lg text-gray-900">
            {user.name || "Mon compte"}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-gray-500">
            {user.email}
          </Text>
          {!!user.phone && (
            <Text numberOfLines={1} className="text-gray-500">
              {user.phone}
            </Text>
          )}
        </View>
        <View className="self-start rounded-full bg-green-100 px-3 py-1">
          <Text className="text-xs font-bold text-green-700">
            {ROLE_LABELS[user.role] ?? user.role}
          </Text>
        </View>
      </View>

      {/* Édition des infos */}
      {editing ? (
        <View className="mt-4 rounded-3xl bg-white p-5" style={CARD_SHADOW}>
          <Text className="mb-3 font-display text-base text-gray-900">Modifier mes infos</Text>
          <Text className="mb-1 ml-1 font-body-semibold text-xs text-muted">Nom complet</Text>
          <TextInput
            value={editName}
            onChangeText={setEditName}
            placeholder="Votre nom"
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="Nom complet"
            className="min-h-12 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-body text-gray-900"
          />
          <View className="mt-3">
            <MaliPhoneInput value={editPhone} onChange={setEditPhone} label="Téléphone" />
          </View>
          <Text className="mb-1 ml-1 mt-3 font-body-semibold text-xs text-muted">Adresse de livraison</Text>
          <TextInput
            value={editAddress}
            onChangeText={setEditAddress}
            placeholder="Ex : Badalabougou, près de la pharmacie…"
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="Adresse de livraison"
            multiline
            style={{ textAlignVertical: "top" }}
            className="min-h-20 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-body text-gray-900"
          />
          <Text className="mb-1 ml-1 mt-3 font-body-semibold text-xs text-muted">Ville</Text>
          <CityPicker value={editCity} onChange={setEditCity} />
          {error ? <Text className="mt-2 font-body text-sm text-red-600">{error}</Text> : null}
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={() => { setEditing(false); setError(null); }}
              accessibilityRole="button"
              className="h-12 flex-1 items-center justify-center rounded-2xl bg-gray-100 active:opacity-80"
            >
              <Text className="font-body-semibold text-gray-600">Annuler</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={saving || !editName.trim() || !editPhone.trim()}
              accessibilityRole="button"
              className={`h-12 flex-1 flex-row items-center justify-center rounded-2xl bg-brand active:opacity-80 ${saving || !editName.trim() || !editPhone.trim() ? "opacity-50" : ""}`}
            >
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text className="font-display-semibold text-white">Enregistrer</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={startEdit}
          accessibilityRole="button"
          className="mt-4 h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-white active:opacity-80"
          style={CARD_SHADOW}
        >
          <Pencil size={16} color="#16a34a" />
          <Text className="font-body-semibold text-gray-700">Modifier mes infos</Text>
        </Pressable>
      )}

      {/* Section activité */}
      <Text className="mb-2 ml-1 mt-8 text-xs font-bold uppercase tracking-wider text-gray-400">
        Mon activité
      </Text>
      <View className="overflow-hidden rounded-3xl bg-white" style={CARD_SHADOW}>
        <Row
          icon={<Package size={20} color="#16a34a" />}
          label="Mes commandes"
          onPress={() => router.push("/commandes")}
        />
        <View className="ml-16 h-px bg-gray-100" />
        <Row icon={<Truck size={20} color="#16a34a" />} label="Suivi de livraison" onPress={() => router.push("/suivi")} />
      </View>

      {/* Déconnexion */}
      <Pressable
        onPress={logout}
        accessibilityRole="button"
        className="mt-8 h-12 flex-row items-center justify-center rounded-2xl border border-red-200 bg-red-50 active:opacity-80"
      >
        <LogOut size={18} color="#DC2626" />
        <Text className="ml-2 font-display-semibold text-red-600">Se déconnecter</Text>
      </Pressable>

      <Text className="mt-8 text-center text-xs text-gray-300">Lumoo — Mali</Text>
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  onPress,
  soon,
}: {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  soon?: boolean;
}) {
  const content = (
    <View className="min-h-14 flex-row items-center px-4">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-green-50">
        {icon}
      </View>
      <Text className="ml-3 flex-1 font-body-semibold text-gray-800">{label}</Text>
      {soon && (
        <View className="mr-1 rounded-full bg-amber-100 px-2.5 py-1">
          <Text className="text-xs font-bold text-amber-700">Bientôt</Text>
        </View>
      )}
      <ChevronRight size={18} color="#D1D5DB" />
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" className="active:bg-gray-50">
        {content}
      </Pressable>
    );
  }
  return content;
}
