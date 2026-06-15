import "react-native-url-polyfill/auto";

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { initCore, ProductProvider } from '@lumoo/core';
import { mobileStorage } from '../lib/storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/env';

initCore({
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  storage: mobileStorage,
  detectSessionInUrl: false,
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ProductProvider>
        <AnimatedSplashOverlay />
        <AppTabs />
      </ProductProvider>
    </ThemeProvider>
  );
}
