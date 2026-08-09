import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mono } from '@/components/ui/typography';
import { useOnline } from '@/lib/network';

/**
 * Mounted once at the root layout, same pattern as `NotificationToast` — a
 * connectivity drop is not any one screen's problem, so it isn't any one
 * screen's job to say so. Nothing underneath actually stops working: every
 * screen already reads from the AsyncStorage-backed store and the local
 * corpus first, so going offline just means writes queue up as the usual
 * fire-and-forget failures they already tolerate — this banner exists so
 * that's visible instead of silent.
 */
function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <SafeAreaView pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 90 }}>
      <View className="mx-4 mt-2 flex-row items-center gap-2 self-start rounded-full border border-border bg-card px-3.5 py-2">
        <Mono className="text-accent">Offline</Mono>
        <Mono>Showing what we last saved</Mono>
      </View>
    </SafeAreaView>
  );
}

export { OfflineBanner };
