import { useState, useEffect, type ReactNode } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Check, ChevronLeft, Copy } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useCart, useOrders, useAuth, apiGetPaymentMethods, type PaymentMethod, type PaymentMethodConfig, type PaymentMethodType } from "@lumoo/core";
import { MaliPhoneInput } from "@/components/MaliPhoneInput";
import { CityPicker } from "@/components/CityPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { OrangeMoneyLogo, MoovMoneyLogo, WaveLogo, CashLogo } from "@/components/PaymentLogos";
import { openOrder } from "@/lib/whatsapp";
import { saveRecentOrder } from "@/lib/recent-orders";

function formatFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

type Step = "livraison" | "paiement" | "confirmation";

const PM_LOGOS: Record<PaymentMethod, ReactNode> = {
  orange_money: <OrangeMoneyLogo />,
  moov_money: <MoovMoneyLogo />,
  wave: <WaveLogo />,
  livraison: <CashLogo />,
};
const PM_DEFAULT: { id: PaymentMethod; name: string; desc: string; type: PaymentMethodType; payUrl: string | null }[] = [
  { id: "orange_money", name: "Orange Money", desc: "Payez avec Orange Money", type: "manual", payUrl: null },
  { id: "moov_money", name: "Moov Money", desc: "Payez avec Moov Money", type: "manual", payUrl: null },
  { id: "wave", name: "Wave", desc: "Payez avec Wave", type: "manual", payUrl: null },
  { id: "livraison", name: "Paiement à la livraison", desc: "Payez en espèces à la réception", type: "cash", payUrl: null },
];

// Paiement en ligne (type 'link') : ouvre la page de paiement hébergée dans le
// navigateur SYSTÈME (sécurisé, pas une WebView) et récupère le résultat via le
// retour deep link. La logique vit côté serveur (pay_url) → nouveau fournisseur =
// aucune nouvelle build. Dormant tant qu'aucune pay_url n'est définie en base.
//
// ⚠️ SÉCURITÉ — AVANT TOUT VRAI PAIEMENT : ne JAMAIS faire confiance au `status`
// du retour (il est forgeable : lumoo://payment-return?status=success). Le vrai
// "payé" doit venir d'un WEBHOOK fournisseur (authentifié) qui marque la commande
// en base ; ici on devra alors RE-VÉRIFIER la commande en base, pas croire l'URL.
// Le montant doit aussi être recalculé côté serveur (pas l'`amount` du client).
async function runHostedPayment(payUrl: string, orderId: string, amount: number): Promise<boolean> {
  const returnUrl = Linking.createURL("payment-return");
  const sep = payUrl.includes("?") ? "&" : "?";
  const url = `${payUrl}${sep}order=${encodeURIComponent(orderId)}&amount=${amount}&return=${encodeURIComponent(returnUrl)}`;
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  if (result.type !== "success" || !result.url) return false; // annulé / fermé
  const status = Linking.parse(result.url).queryParams?.status;
  return status === "success" || status === "ok" || status === "paid";
}

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
  const [deliveryCode, setDeliveryCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pmConfig, setPmConfig] = useState<PaymentMethodConfig[]>([]);

  // Pré-remplir nom + téléphone depuis le profil quand l'utilisateur est connecté
  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.name || "");
      setPhone((prev) => prev || user.phone || "");
      setAddress((prev) => prev || user.address || "");
      setCity((prev) => prev || user.city || "");
    }
  }, [user]);

  // Méthodes de paiement : config admin (n'affiche que les `enabled`), repli sur PM_DEFAULT.
  useEffect(() => {
    apiGetPaymentMethods().then(setPmConfig);
  }, []);

  const payments = (
    pmConfig.length
      ? pmConfig.filter((m) => m.enabled).map((m) => ({ id: m.id, name: m.label, desc: m.description, type: m.type, payUrl: m.payUrl }))
      : PM_DEFAULT
  ).map((m) => ({ ...m, logo: PM_LOGOS[m.id] }));
  const selected = payments.find((p) => p.id === paymentMethod);

  const canProceed = !!(name && phone && address && city);
  const canPay = !!paymentMethod && (selected?.type !== "manual" || !!paymentPhone);

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
      setDeliveryCode(order.deliveryCode);

      // Paiement en ligne (type 'link') : page hébergée + retour deep link sécurisé.
      if (selected?.type === "link" && selected.payUrl) {
        const paid = await runHostedPayment(selected.payUrl, order.id, order.totalPrice ?? totalPrice);
        if (!paid) {
          setError("Le paiement n'a pas été confirmé. Réessaie ou choisis un autre mode.");
          return;
        }
      }

      // Persistance locale : permet de re-suivre la commande sans compte (surtout les invités).
      void saveRecentOrder({
        id: order.id,
        code: order.deliveryCode,
        date: order.createdAt ?? new Date().toISOString(),
        total: order.totalPrice ?? totalPrice,
      });
      setStep("confirmation");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyInfos = async () => {
    await Clipboard.setStringAsync(
      `Lumoo — ma commande\nN° : ${orderId}\nCode de livraison : ${deliveryCode}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerClassName="p-4 pb-40" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
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
            {payments.map((m) => (
              <Pressable key={m.id} onPress={() => setPaymentMethod(m.id)} accessibilityRole="button" accessibilityState={{ selected: paymentMethod === m.id }} className={`flex-row items-center gap-3 rounded-2xl border-2 bg-white p-4 ${paymentMethod === m.id ? "border-brand" : "border-gray-100"}`}>
                {m.logo}
                <View className="flex-1">
                  <Text className="font-display text-gray-800">{m.name}</Text>
                  <Text className="font-body text-[11px] text-gray-400">{m.desc}</Text>
                </View>
              </Pressable>
            ))}
            {selected?.type === "manual" ? (
              <MaliPhoneInput value={paymentPhone} onChange={setPaymentPhone} label="Numéro de paiement *" />
            ) : null}
            {error ? <Text className="text-center font-body text-sm text-red-600">{error}</Text> : null}
            <Pressable onPress={submit} disabled={!canPay || submitting} accessibilityRole="button" className={`mt-2 h-12 flex-row items-center justify-center rounded-2xl bg-brand active:opacity-80 ${!canPay || submitting ? "opacity-50" : ""}`}>
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-display-semibold text-white">
                  {selected?.type === "cash" ? "Confirmer la commande" : `Payer ${formatFCFA(totalPrice)}`}
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
            <View className="w-full items-center rounded-3xl bg-brand p-5">
              <Text className="font-body text-[11px] uppercase tracking-widest text-white opacity-80">🔒 Code de livraison</Text>
              <Text className="mt-1 font-display text-3xl text-white" style={{ letterSpacing: 6 }}>{deliveryCode}</Text>
              <Text className="mt-1 text-center font-body text-[11px] text-white opacity-80">Gardez ce code : il sert au suivi et à la remise au livreur.</Text>
            </View>
            <Pressable
              onPress={copyInfos}
              accessibilityRole="button"
              accessibilityLabel="Copier le numéro et le code de la commande"
              className="h-12 w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 border-brand bg-white active:opacity-80"
            >
              {copied ? <Check size={18} color="#16a34a" /> : <Copy size={18} color="#16a34a" />}
              <Text className="font-display-semibold text-brand">
                {copied ? "Copié ✓" : "Copier mon n° et mon code"}
              </Text>
            </Pressable>
            <Pressable onPress={sendWhatsApp} accessibilityRole="button" accessibilityLabel="Confirmer par WhatsApp" className="h-12 w-full flex-row items-center justify-center gap-2 rounded-2xl bg-whatsapp active:opacity-90">
              <Text className="font-display-semibold text-white">Confirmer par WhatsApp</Text>
            </Pressable>
            <Pressable onPress={finish} accessibilityRole="button" className="h-12 w-full items-center justify-center rounded-2xl bg-gray-100 active:opacity-80">
              <Text className="font-body-semibold text-gray-600">Retour à la boutique</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
