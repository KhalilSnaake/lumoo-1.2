import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Check, X } from "lucide-react-native";
import { useAuth } from "@lumoo/core";
import { HomeBanner } from "./ad-banner";

const BENEFITS = [
  "Suivez vos commandes et vos livraisons",
  "Livraison rapide à domicile (Bamako & environs)",
  "Retrouvez votre historique et vos reçus",
  "Commandez plus vite la prochaine fois",
];

export function CreateAccountModal() {
  const { isLoggedIn } = useAuth();
  const [visible, setVisible] = useState(false);

  // S'affiche à chaque lancement de l'app tant que l'utilisateur n'est pas connecté.
  useEffect(() => {
    if (isLoggedIn) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(t);
  }, [isLoggedIn]);

  function dismiss() {
    setVisible(false);
  }

  function goToAccount() {
    dismiss();
    router.navigate("/compte");
  }

  if (isLoggedIn) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View className="flex-1 items-center justify-center bg-black/50 p-5">
        <View className="w-full max-w-md overflow-hidden rounded-3xl bg-white">
          {/* Bandeau Lumoo (pub si active, sinon PromoBanner) */}
          <View>
            <HomeBanner rounded={false} />
            <Pressable
              onPress={dismiss}
              hitSlop={8}
              accessibilityLabel="Fermer"
              className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-white/90"
            >
              <X size={18} color="#374151" />
            </Pressable>
          </View>

          <View className="p-5">
            <Text className="font-display text-xl text-gray-900">Créez votre compte Lumoo</Text>
            <Text className="mt-1 font-body text-gray-500">Gratuit, en 30 secondes.</Text>

            <View className="mt-4 gap-2">
              {BENEFITS.map((b) => (
                <View key={b} className="flex-row items-center">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-green-100">
                    <Check size={14} color="#16a34a" />
                  </View>
                  <Text className="ml-2 flex-1 font-body text-gray-700">{b}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={goToAccount}
              accessibilityRole="button"
              className="mt-5 h-12 items-center justify-center rounded-2xl bg-brand active:opacity-80"
            >
              <Text className="font-display-semibold text-white">Créer un compte</Text>
            </Pressable>
            <Pressable
              onPress={goToAccount}
              accessibilityRole="button"
              className="mt-2 h-11 items-center justify-center"
            >
              <Text className="font-body-semibold text-brand">
                J&apos;ai déjà un compte — Se connecter
              </Text>
            </Pressable>
            <Pressable
              onPress={dismiss}
              accessibilityRole="button"
              className="mt-1 h-10 items-center justify-center"
            >
              <Text className="font-body text-gray-400">Plus tard</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
