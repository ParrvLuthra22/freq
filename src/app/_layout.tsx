import '../global.css';

import { PortalHost } from '@rn-primitives/portal';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { colorScheme, useColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { NotificationToast } from '@/components/ui/notification-toast';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { useAppFonts } from '@/hooks/use-app-fonts';
import { useAuth } from '@/lib/auth';
import { hydrateStore, reconcileWithSupabase } from '@/lib/store';
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
  const [storeReady, setStoreReady] = React.useState(false);

  // Read persisted profile/likes before the first paint, so no screen ever
  // flashes the seed defaults and then swaps to the real values.
  React.useEffect(() => {
    hydrateStore().finally(() => setStoreReady(true));
  }, []);

  // Belt and braces for platforms the native manifest does not cover. The real
  // guarantee is UIUserInterfaceStyle=Dark in app.json/Info.plist: while iOS
  // reported "automatic" it handed back the simulator's light appearance, and
  // nativewind's system-appearance sync raced this call and won often enough to
  // render whole screens in the cream palette.
  React.useEffect(() => {
    colorScheme.set('dark');
  }, []);

  // Auth resolves to 'local' immediately when no project is configured, so this
  // gate costs nothing while the backend is being wired.
  const { mode, session } = useAuth();
  const authReady = mode !== 'loading';

  // Step two of hydration, deliberately not part of the paint gate above: the
  // cache already answered every screen's first read, so reconciling against
  // Supabase happens in the background and the store's own subscribers pick up
  // whatever changes once it lands.
  React.useEffect(() => {
    if (session) void reconcileWithSupabase(session);
  }, [session]);

  React.useEffect(() => {
    if ((fontsLoaded || fontError) && storeReady && authReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, storeReady, authReady]);

  if ((!fontsLoaded && !fontError) || !storeReady || !authReady) {
    return null;
  }

  const theme = NAV_THEME[scheme ?? 'dark'];

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
        </Stack>
        {/* Mounted once, here — a delayed match or a fresh like can land on any
            screen, and this is the one place guaranteed to be rendered
            regardless of route. */}
        <NotificationToast />
        <OfflineBanner />
        <PortalHost />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
