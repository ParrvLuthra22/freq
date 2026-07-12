import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';

import { THEME } from '@/lib/theme';

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.mutedForeground,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: { fontFamily: 'Geist-Medium', fontSize: 11 },
      }}>
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="freq" options={{ title: 'FREQ' }} />
      <Tabs.Screen name="sync" options={{ title: 'Sync' }} />
      <Tabs.Screen name="rooms" options={{ title: 'Rooms' }} />
    </Tabs>
  );
}
