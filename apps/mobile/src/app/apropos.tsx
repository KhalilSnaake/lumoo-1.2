import { type ReactNode } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Eye,
  Heart,
  type LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Target,
  Truck,
} from "lucide-react-native";
import { MoovMoneyLogo, OrangeMoneyLogo, WaveLogo } from "@/components/PaymentLogos";

const PHONE = "+22384007200";
const EMAIL = "contact@lumoo.ml";
const WHATSAPP = "https://wa.me/22384007200";

const STEPS = [
  "Parcourez les produits dans l'application",
  "Préparez votre panier et commandez via WhatsApp",
  "Confirmez la livraison et le paiement",
  "Recevez votre commande chez vous",
];

const REASONS = [
  "Produits frais, directement des producteurs",
  "Livraison rapide à Bamako et environs",
  "Prix justes et transparents",
  "Paiement mobile money ou à la livraison",
  "Support réactif sur WhatsApp",
];

const PARTNERS: { name: string; logo: ReactNode }[] = [
  { name: "Orange Money", logo: <OrangeMoneyLogo /> },
  { name: "Moov Money", logo: <MoovMoneyLogo /> },
  { name: "Wave", logo: <WaveLogo /> },
];

function SectionTitle({ icon: Icon, children }: { icon?: LucideIcon; children: string }) {
  return (
    <View className="mb-3 flex-row items-center">
      {Icon ? <Icon size={22} color="#16a34a" /> : null}
      <Text className={`font-display text-xl text-ink ${Icon ? "ml-2" : ""}`}>{children}</Text>
    </View>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "link" : "text"}
      accessibilityLabel={`${label} : ${value}`}
      className="mb-2 min-h-[48px] flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-3 active:bg-gray-50"
    >
      <Icon size={22} color="#16a34a" />
      <View className="ml-3 flex-1">
        <Text className="font-body text-xs text-gray-600">{label}</Text>
        <Text className="font-display-semibold text-base text-ink">{value}</Text>
      </View>
    </Pressable>
  );
}

export default function AProposScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="pb-10">
      <View className="bg-emerald-600 px-5 pb-8 pt-6">
        <Text className="font-display text-3xl text-white">À propos de Lumoo</Text>
        <Text className="mt-2 font-body text-base leading-6 text-white">
          Les produits du Mali, livrés chez vous. Simple, frais et au juste prix.
        </Text>
      </View>

      <View className="px-5 pt-6">
        <View className="mb-6 rounded-3xl border border-green-100 bg-green-50 p-5">
          <SectionTitle icon={Eye}>Notre vision</SectionTitle>
          <Text className="font-body text-base leading-6 text-gray-800">
            Devenir la référence du commerce en ligne au Mali, où chaque famille accède facilement à des produits
            de qualité, et où chaque producteur local peut vendre à plus grande échelle.
          </Text>
        </View>

        <View className="mb-6 rounded-3xl border border-green-100 bg-green-50 p-5">
          <SectionTitle icon={Target}>Notre mission</SectionTitle>
          <Text className="font-body text-base leading-6 text-gray-800">
            Connecter les producteurs et commerçants maliens directement aux consommateurs, livrer vite, à prix
            juste, et soutenir l'économie locale.
          </Text>
        </View>

        <View className="mb-6">
          <SectionTitle icon={Truck}>Comment ça marche ?</SectionTitle>
          {STEPS.map((step, i) => (
            <View key={step} className="mb-2 flex-row items-center rounded-2xl border border-gray-200 bg-white p-4">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-green-600">
                <Text className="font-display text-base text-white">{i + 1}</Text>
              </View>
              <Text className="ml-3 flex-1 font-body text-base leading-6 text-gray-800">{step}</Text>
            </View>
          ))}
        </View>

        <View className="mb-6">
          <SectionTitle icon={Heart}>Pourquoi nous ?</SectionTitle>
          {REASONS.map((reason) => (
            <View key={reason} className="mb-2 flex-row items-start rounded-2xl border border-gray-200 bg-white p-4">
              <ShieldCheck size={20} color="#16a34a" />
              <Text className="ml-3 flex-1 font-body text-base leading-6 text-gray-800">{reason}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mb-6">
        <View className="px-5">
          <SectionTitle>Nos partenaires</SectionTitle>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-5"
          accessibilityLabel="Liste des partenaires"
        >
          {PARTNERS.map((p) => (
            <View
              key={p.name}
              accessible
              accessibilityLabel={p.name}
              className="mr-3 h-20 min-w-[120px] items-center justify-center rounded-2xl border border-gray-200 bg-white px-4"
            >
              {p.logo}
            </View>
          ))}
        </ScrollView>
      </View>

      <View className="px-5">
        <SectionTitle>Nous contacter</SectionTitle>
        <Pressable
          onPress={() => Linking.openURL(WHATSAPP)}
          accessibilityRole="button"
          accessibilityLabel="Nous écrire sur WhatsApp"
          className="mb-3 min-h-[52px] flex-row items-center justify-center rounded-full bg-[#25D366] px-6 py-3 active:scale-95"
        >
          <MessageCircle size={22} color="#ffffff" />
          <Text className="ml-2 font-display text-base text-white">Écrire sur WhatsApp</Text>
        </Pressable>
        <ContactRow icon={Phone} label="Téléphone" value="+223 84 00 72 00" onPress={() => Linking.openURL(`tel:${PHONE}`)} />
        <ContactRow icon={Mail} label="Email" value={EMAIL} onPress={() => Linking.openURL(`mailto:${EMAIL}`)} />
        <ContactRow icon={MapPin} label="Adresse" value="Bamako, Mali" />
        <Pressable
          onPress={() => router.push("/contact")}
          accessibilityRole="button"
          className="mt-2 min-h-[48px] items-center justify-center rounded-full border border-green-600 px-6 py-3 active:scale-95"
        >
          <Text className="font-display-semibold text-base text-green-700">Envoyer un message</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
