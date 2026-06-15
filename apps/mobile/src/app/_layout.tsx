import "react-native-url-polyfill/auto";
import "../global.css";

import { Stack } from "expo-router";
import { initCore, ProductProvider } from "@lumoo/core";
import { mobileStorage } from "../lib/storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/env";

initCore({
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  storage: mobileStorage,
  detectSessionInUrl: false,
});

export default function RootLayout() {
  return (
    <ProductProvider>
      <Stack screenOptions={{ headerTitle: "Lumoo" }} />
    </ProductProvider>
  );
}
