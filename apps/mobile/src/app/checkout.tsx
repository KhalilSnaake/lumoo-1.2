import { useState, useEffect, type ReactNode } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useCart, useOrders, useAuth, type PaymentMethod } from "@lumoo/core";
import { MaliPhoneInput } from "@/components/MaliPhoneInput";
import { CityPicker } from "@/components/CityPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { OrangeMoneyLogo, WaveLogo, CashLogo } from "@/components/PaymentLogos";
import { openOrder } from "@/lib/whatsapp";

function formatFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

type Step = "livraison" | "paiement" | "confirmation";

const PAYMENTS: { id: PaymentMethod; name: string; desc: string; logo: ReactNode }[] = [
  { id: "orange_money", name: "Orange Money", desc: "Payez avec Orange Money", logo: <OrangeMoneyLogo /> },
  { id: "wave", name: "Wave", desc: "Payez avec Wave", logo: <WaveLogo /> },
  { id: "livraison", name: "Paiement à la livraison", desc: "Payez en espèces à la réception", logo: <CashLogo /> },
];

const STEP_ORDER: Step[] = ["livraison", "paiement", "confirmation"];
const TITLES: Record<Step, string> = { livraison: "Livraison", paiement: "Paiement", confirmation: "Confirmation" };

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { items, totalPrice, clearCart } = useCart();
  const { createOrder } = useOrders();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("livraison");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [gps, setGps] = useState<{ lat?: number; lng?: number }>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [orderId, setOrderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-remplir nom + téléphone depuis le profil quand l'utilisateur est connecté
  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.name || "");
      setPhone((prev) => prev || user.phone || "");
    }
  }, [user]);

  const canProceed = !!(name && phone && address && city);
  const canPay = !!paymentMethod && (paymentMethod === "livraison" || !!paymentPhone);

  const goBack = () => {
    if (step === "paiement") setStep("livraison");
    else if (step === "livraison") router.back();
  };

  const submit = async () => {
    if (!paymentMethod) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder({
        userId: user?.id,
        items,
        customerName: name,
        customerPhone: phone,
        address,
        city,
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        paymentMethod,
        paymentPhone,
      });
      setOrderId(order.id);
      setStep("confirmation");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendWhatsApp = () => {
    const lines = items.map((it) => `• ${it.product.name} × ${it.quantity}`).join("\n");
    openOrder(
      `Bonjour Lumoo ! Commande n° ${orderId}\n\nArticles :\n${lines}\n\nTotal : ${formatFCFA(totalPrice)}\nLivraison : ${name}, ${city} — ${phone}`,
    );
  };

  const finish = () => {
    clearCart();
    router.replace("/(tabs)");
  };

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center border-b border-gray-100 bg-white px-3 py-3">
        {step !== "confirmation" ? (
          <Pressable onPress={goBack} hitSlop={8} accessibilityLabel="Retour" className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
            <ChevronLeft size={22} color="#374151" />
          </Pressable>
        ) : (
          <View className="w-10" />
        )}
        <Text className="ml-1 font-display text-lg text-ink">{TITLES[step]}</Text>
        <View className="ml-auto flex-row gap-1.5">
          {STEP_ORDER.map((s, i) => (
            <View key={s} className={`h-1.5 w-6 rounded-full ${STEP_ORDER.indexOf(step) >= i ? "bg-brand" : "bg-gray-200"}`} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerClassName="p-4" keyboardShouldPersistTaps="handled">
        {step === "livraison" ? (
          <View className="gap-4">
            <View className="flex-row items-center justify-between rounded-2xl border border-green-100 bg-green-50 p-4">
              <Text className="font-body-semibold text-green-800">Total panier</Text>
              <Text className="font-display text-lg text-brand">{formatFCFA(totalPrice)}</Text>
            </View>
            <View>
              <Text className="mb-1 ml-1 font-body-semibold text-xs text-muted">Nom complet *</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Ex : Aïssata Traoré" placeholderTextColor="#9CA3AF" accessibilityLabel="Nom complet" className="min-h-12 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-body text-gray-900" />
            </View>
            <MaliPhoneInput value={phone} onChange={setPhone} label="Téléphone *" />
            <View>
              <Text className="mb-1 ml-1 font-body-semibold text-xs text-muted">Adresse de livraison *</Text>
              <TextInput value={address} onChangeText={setAddress} placeholder="Ex : Badalabougou, près de la pharmacie…" placeholderTextColor="#9CA3AF" accessibilityLabel="Adresse de livraison" multiline style={{ textAlignVertical: "top" }} className="min-h-20 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-body text-gray-900" />
            </View>
            <View>
              <Text className="mb-1 ml-1 font-body-semibold text-xs text-muted">Ville *</Text>
              <CityPicker value={city} onChange={setCity} />
            </View>
            <View>
              <Text className="mb-1 ml-1 font-body-semibold text-xs text-muted">Localisation (GPS) — optionnel</Text>
              <LocationPicker lat={gps.lat} lng={gps.lng} onChange={(la, ln) => setGps({ lat: la, lng: ln })} />
            </View>
            <Pressable onPress={() => setStep("paiement")} disabled={!canProceed} accessibilityRole="button" className={`mt-2 h-12 items-center justify-center rounded-2xl bg-brand active:opacity-80 ${!canProceed ? "opacity-40" : ""}`}>
              <Text className="font-display-semibold text-white">Continuer vers le paiement</Text>
            </Pressable>
          </View>
        ) : null}

        {step === "paiement" ? (
          <View className="gap-3">
            <Text className="text-center font-display text-lg text-ink">Mode de paiement</Text>
            {PAYMENTS.map((m) => (
              <Pressable key={m.id} onPress={() => setPaymentMethod(m.id)} accessibilityRole="button" accessibilityState={{ selected: paymentMethod === m.id }} className={`flex-row items-center gap-3 rounded-2xl border-2 bg-white p-4 ${paymentMethod === m.id ? "border-brand" : "border-gray-100"}`}>
                {m.logo}
                <View className="flex-1">
                  <Text className="font-display text-gray-800">{m.name}</Text>
                  <Text className="font-body text-[11px] text-gray-400">{m.desc}</Text>
                </View>
              </Pressable>
            ))}
            {paymentMethod && paymentMethod !== "livraison" ? (
              <MaliPhoneInput value={paymentPhone} onChange={setPaymentPhone} label="Numéro de paiement *" />
            ) : null}
            {error ? <Text className="text-center font-body text-sm text-red-600">{error}</Text> : null}
            <Pressable onPress={submit} disabled={!canPay || submitting} accessibilityRole="button" className={`mt-2 h-12 flex-row items-center justify-center rounded-2xl bg-brand active:opacity-80 ${!canPay || submitting ? "opacity-50" : ""}`}>
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-display-semibold text-white">
                  {paymentMethod === "livraison" ? "Confirmer la commande" : `Payer ${formatFCFA(totalPrice)}`}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {step === "confirmation" ? (
          <View className="items-center gap-5 pt-8">
            <Text className="text-6xl">🎉</Text>
            <Text className="font-display text-2xl text-ink">Commande réussie !</Text>
            <View className="w-full items-center rounded-3xl border border-green-100 bg-green-50 p-5">
              <Text className="font-body text-[11px] uppercase tracking-widest text-green-700">Numéro de commande</Text>
              <Text className="mt-1 font-display text-xl text-green-800">{orderId}</Text>
            </View>
            <Pressable onPress={sendWhatsApp} accessibilityRole="button" accessibilityLabel="Confirmer par WhatsApp" className="h-12 w-full flex-row items-center justify-center gap-2 rounded-2xl bg-whatsapp active:opacity-90">
              <Text className="font-display-semibold text-white">Confirmer par WhatsApp</Text>
            </Pressable>
            <Pressable onPress={finish} accessibilityRole="button" className="h-12 w-full items-center justify-center rounded-2xl bg-gray-100 active:opacity-80">
              <Text className="font-body-semibold text-gray-600">Retour à la boutique</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
