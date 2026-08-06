import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumArt } from '@/components/ui/album-art';
import { Body, Mono } from '@/components/ui/typography';
import { getUserById } from '@/lib/seed';
import { dismissMatchToast, useMatchToast } from '@/lib/toast';

/**
 * The banner for a match that landed while you were not looking — a mock
 * "liking back" after a delay confirmed server-side, or the same beat in local
 * mode. Mounted once at the root layout so it floats over whatever screen is
 * active, not owned by any one route.
 *
 * The avatar renders unsealed on purpose: this notification only exists
 * because the match is real, so there is nothing left to keep blurred.
 *
 * Plain conditional rendering, no entrance/exit animation. Reanimated's
 * `entering`/`exiting` presets (mount-triggered) left this stuck
 * `visibility: hidden` mid a phantom exit animation on its very first
 * appearance on web; switching to a manually driven `withTiming` opacity
 * still never animated past 0, for reasons that did not resolve within this
 * pass. Showing and hiding outright is correct and visible, which matters
 * more here than a slide-in — motion can come back once the underlying
 * Reanimated-web behavior is understood.
 */
function MatchToast() {
  const userId = useMatchToast();
  const user = userId ? getUserById(userId) : undefined;

  if (!user) return null;

  const open = () => {
    dismissMatchToast();
    router.push(`/reveal/${user.id}`);
  };

  return (
    <SafeAreaView
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, elevation: 100 }}>
      <Pressable
        onPress={open}
        className="mx-4 mt-2 flex-row items-center gap-3 rounded-2xl border border-accent bg-card px-3.5 py-3 active:opacity-90"
        style={{ shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <AlbumArt seed={user.id} size={40} shape="circle" />
        <Body className="flex-1" numberOfLines={2}>
          <Mono className="text-accent">It&apos;s mutual — </Mono>
          {user.name} is in sync with you.
        </Body>
        <Mono className="text-accent">Open</Mono>
      </Pressable>
    </SafeAreaView>
  );
}

export { MatchToast };
