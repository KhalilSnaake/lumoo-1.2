import "react-native-url-polyfill/auto";
import "../global.css";

import { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  SplineSans_600SemiBold,
  SplineSans_700Bold,
} from "@expo-google-fonts/spline-sans";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import {
  initCore,
  useAuth,
  getSupabase,
  AuthProvider,
  NotificationProvider,
  AdProvider,
  ProductProvider,
  CategoryProvider,
  CartProvider,
  OrderProvider,
} from "@lumoo/core";
import { parseAuthCallback } from "@/lib/recovery-link";
import { mobileStorage } from "../lib/storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/env";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { CreateAccountModal } from "@/components/create-account-modal";
import { ToastProvider } from "@/context/ToastContext";
import * as Notifications from "expo-notifications";
import { registerForPushNotifications } from "@/lib/push";

initCore({
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  storage: mobileStorage,
  detectSessionInUrl: false,
  authRedirectUrl: Linking.createURL("auth-callback"),
});

SplashScreen.preventAutoHideAsync();

// Enregistre le token push (lié au user_id si connecté) et route au tap sur une notif.
// Doit vivre DANS les providers (utilise useAuth).
function PushRegistrar() {
  const { user } = useAuth();
  useEffect(() => {
    void registerForPushNotifications();
  }, [user?.id]);
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const orderId = response.notification.request.content.data?.orderId as string | undefined;
      if (!orderId) return;
      // Connecté → détail de la commande ; invité → suivi par n°+code (pas d'accès RLS au détail).
      if (user) router.push(`/commande/${orderId}`);
      else router.push("/suivi");
    });
    return () => sub.remove();
  }, [user?.id]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SplineSans_600SemiBold,
    SplineSans_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      const cb = parseAuthCallback(url);
      if (!cb) return;
      getSupabase()
        .auth.setSession({ access_token: cb.access_token, refresh_token: cb.refresh_token })
        .then(() => {
          if (cb.type === "recovery") router.push("/reset-password");
          else router.replace("/(tabs)");
        })
        .catch(() => {});
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener("url", (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ToastProvider>
    <AuthProvider>
      <NotificationProvider>
      <AdProvider>
      <ProductProvider>
        <CategoryProvider>
          <CartProvider>
            <OrderProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="produit/[id]"
                  options={{
                    headerShown: true,
                    title: "Produit",
                    headerStyle: { backgroundColor: "#ffffff" },
                    headerTintColor: "#16a34a",
                    headerTitleStyle: { fontWeight: "800", color: "#16a34a" },
                  }}
                />
                <Stack.Screen name="checkout" options={{ headerShown: false }} />
                <Stack.Screen name="reset-password" options={{ headerShown: false }} />
                <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
                <Stack.Screen
                  name="legal/[doc]"
                  options={{
                    headerShown: true,
                    title: "Informations légales",
                    headerStyle: { backgroundColor: "#ffffff" },
                    headerTintColor: "#16a34a",
                    headerTitleStyle: { fontWeight: "800", color: "#16a34a" },
                  }}
                />
                <Stack.Screen
                  name="notifications"
                  options={{
                    headerShown: true,
                    title: "Notifications",
                    headerStyle: { backgroundColor: "#ffffff" },
                    headerTintColor: "#16a34a",
                    headerTitleStyle: { fontWeight: "800", color: "#16a34a" },
                  }}
                />
                <Stack.Screen
                  name="commande/[id]"
                  options={{
                    headerShown: true,
                    title: "Commande",
                    headerStyle: { backgroundColor: "#ffffff" },
                    headerTintColor: "#16a34a",
                    headerTitleStyle: { fontWeight: "800", color: "#16a34a" },
                  }}
                />
                <Stack.Screen
                  name="changer-mot-de-passe"
                  options={{
                    headerShown: true,
                    title: "Mot de passe",
                    headerStyle: { backgroundColor: "#ffffff" },
                    headerTintColor: "#16a34a",
                    headerTitleStyle: { fontWeight: "800", color: "#16a34a" },
                  }}
                />
                <Stack.Screen
                  name="contact"
                  options={{
                    headerShown: true,
                    title: "Nous contacter",
                    headerStyle: { backgroundColor: "#ffffff" },
                    headerTintColor: "#16a34a",
                    headerTitleStyle: { fontWeight: "800", color: "#16a34a" },
                  }}
                />
              </Stack>
              <PushRegistrar />
              <WhatsAppButton />
              <CreateAccountModal />
              <StatusBar style="dark" />
            </OrderProvider>
          </CartProvider>
        </CategoryProvider>
      </ProductProvider>
      </AdProvider>
      </NotificationProvider>
    </AuthProvider>
    </ToastProvider>
  );
}
