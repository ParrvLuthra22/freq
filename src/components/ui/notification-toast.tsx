import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumArt } from '@/components/ui/album-art';
import { Body, Mono } from '@/components/ui/typography';
import { getUserById } from '@/lib/seed';
import { THEME } from '@/lib/theme';
import { dismissToast, useToast } from '@/lib/toast';

/**
 * The banner for a notification that landed while you were not looking — a
 * match confirming server-side, or a mock sending a fresh like. Mounted once
 * at the root layout so it floats over whatever screen is active, not owned
 * by any one route.
 *
 * A match unseals the avatar: the notification only exists because the match
 * is real, so there is nothing left to keep blurred. A like does not — it
 * stays sealed exactly like every other card on the inbound tab, since liking
 * back is still a decision the user has to make.
 *
 * Plain conditional rendering, no entrance/exit animation. Reanimated's
 * `entering`/`exiting` presets (mount-triggered) left this stuck
 * `visibility: hidden` mid a phantom exit animation on its very first
 * appearance on web; a manually driven `withTiming` opacity never animated
 * past 0 either, for reasons that did not resolve within that pass. Showing
 * and hiding outright is correct and visible, which matters more here than a
 * slide-in — motion can come back once the underlying Reanimated-web behavior
 * is understood.
 */
function NotificationToast() {
  const toast = useToast();
  const user = toast ? getUserById(toast.userId) : undefined;
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];

  if (!toast || !user) return null;

  const open = () => {
    dismissToast();
    router.push(toast.kind === 'match' ? `/reveal/${user.id}` : '/likes');
  };

  return (
    <SafeAreaView
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, elevation: 100 }}>
      <Pressable
        onPress={open}
        className="mx-4 mt-2 flex-row items-center gap-3 rounded-2xl border border-accent bg-card px-3.5 py-3 active:opacity-90"
        style={{ shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden' }}>
          <AlbumArt seed={user.id} size={40} shape="circle" />
          {toast.kind === 'like' ? (
            <BlurView
              intensity={12}
              tint={theme.background === '#100F0D' ? 'dark' : 'light'}
              style={{ position: 'absolute', inset: 0 }}
            />
          ) : null}
        </View>
        <Body className="flex-1" numberOfLines={2}>
          {toast.kind === 'match' ? (
            <>
              <Mono className="text-accent">It&apos;s mutual — </Mono>
              {user.name} is in sync with you.
            </>
          ) : (
            <>
              <Mono className="text-accent">New like — </Mono>
              {user.name} likes your taste.
            </>
          )}
        </Body>
        <Mono className="text-accent">Open</Mono>
      </Pressable>
    </SafeAreaView>
  );
}

export { NotificationToast };
