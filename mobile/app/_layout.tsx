import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenCapture from 'expo-screen-capture';
import { initI18n } from '../src/i18n';
import { MobileThemeProvider, useMobileTheme } from '../src/theme/ThemeProvider';
import { useMobileAuthStore } from '../src/store/authStore';

function RootNavigation() {
  const { resolvedTheme, colors } = useMobileTheme();

  return (
    <>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.textPrimary,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    Promise.all([
      initI18n(),
      useMobileAuthStore.getState().initialize().catch(() => {}),
    ]).finally(() => setReady(true));
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <MobileThemeProvider>
        <RootNavigation />
      </MobileThemeProvider>
    </SafeAreaProvider>
  );
}

