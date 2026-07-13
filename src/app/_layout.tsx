import '../global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { colorScheme, useColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAppFonts } from '@/hooks/use-app-fonts';
import { NAV_THEME } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

// FREQ is dark-first: default the app to dark before the first paint, unless
// the user has already picked a scheme this session. Guarded because on web
// this runs during server rendering too, before `window` exists.
if (typeof window !== 'undefined' || Platform.OS !== 'web') {
  colorScheme.set('dark');
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const { colorScheme: scheme } = useColorScheme();

  // Re-assert dark on mount too: the module-scope call above can be raced by
  // nativewind's own system-appearance sync, leaving background and text
  // resolved from different schemes for a frame (or longer, on native).
  React.useEffect(() => {
    colorScheme.set('dark');
  }, []);

  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const theme = NAV_THEME[scheme ?? 'dark'];

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
          <Stack.Screen name="share" options={{ presentation: 'modal' }} />
        </Stack>
        <PortalHost />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
