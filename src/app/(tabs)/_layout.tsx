import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import type { ColorValue } from 'react-native';

import { TabIcon, type TabIconName } from '@/components/ui/tab-icon';
import { THEME } from '@/lib/theme';

/** Tabs render an icon each — declared once so the three screens stay identical in shape. */
const icon =
  (name: TabIconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    // Navigation types the tint as ColorValue, but it is always a resolved string
    // here since both tint options come from our own theme.
    <TabIcon name={name} color={String(color)} focused={focused} />
  );

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
        tabBarItemStyle: { paddingTop: 6 },
      }}>
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarIcon: icon('discover') }}
      />
      <Tabs.Screen name="freq" options={{ title: 'FREQ', tabBarIcon: icon('freq') }} />
      <Tabs.Screen name="sync" options={{ title: 'Sync', tabBarIcon: icon('sync') }} />
    </Tabs>
  );
}
