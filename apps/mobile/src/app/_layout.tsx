import "react-native-url-polyfill/auto";
import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  SplineSans_600SemiBold,
  SplineSans_700Bold,
} from "@expo-google-fonts/spline-sans";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import {
  initCore,
  AuthProvider,
  ProductProvider,
  CategoryProvider,
  CartProvider,
  OrderProvider,
} from "@lumoo/core";
import { mobileStorage } from "../lib/storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/env";
import { WhatsAppButton } from "@/components/WhatsAppButton";

initCore({
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  storage: mobileStorage,
  detectSessionInUrl: false,
});

SplashScreen.preventAutoHideAsync();

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

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <ProductProvider>
        <CategoryProvider>
          <CartProvider>
            <OrderProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="commandes"
                  options={{
                    headerShown: true,
                    title: "Mes commandes",
                    headerStyle: { backgroundColor: "#16a34a" },
                    headerTintColor: "#ffffff",
                    headerTitleStyle: { fontWeight: "800" },
                  }}
                />
              </Stack>
              <WhatsAppButton />
            </OrderProvider>
          </CartProvider>
        </CategoryProvider>
      </ProductProvider>
    </AuthProvider>
  );
}
