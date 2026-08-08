import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { ShareCard } from '@/components/share-card';
import { AlbumArt } from '@/components/ui/album-art';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import { getMe } from '@/lib/seed';
import { THEME } from '@/lib/theme';

/**
 * "Your week" — the entry moment's own face turned around on you. Candidates
 * are introduced by the artist they're meeting people through this week
 * (`swipe-card.tsx`'s `WeekFace`); this is the identical hero treatment, same
 * data (`me.week`), read as your own.
 *
 * Replaces the v1 `/weekly` stats recap. Share hangs off this screen now
 * instead of a dedicated `/share` route — see `share.tsx`'s own retirement.
 */
export default function WeekScreen() {
  const me = getMe();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];

  const shareCardRef = React.useRef<View>(null);
  const [busy, setBusy] = React.useState(false);

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your FREQ',
        });
      }
    } catch (error) {
      // Sharing can be cancelled or unavailable (no share target, web's stricter
      // Web Share API) — fail quietly rather than leaving the screen broken.
      console.warn('Share failed', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Pressable onPress={() => router.back()} className="self-start px-6 py-3">
        <Mono className="text-accent">← Back</Mono>
      </Pressable>

      <View style={{ position: 'relative' }}>
        <AlbumArt seed={me.week.artist} shape="square" fill />
        <LinearGradient
          colors={['transparent', 'transparent', theme.background]}
          locations={[0, 0.42, 1]}
          style={{ position: 'absolute', inset: 0 }}
        />
        <View className="absolute inset-x-6 bottom-4 gap-1">
          <Mono style={{ color: theme.accent }}>Your artist of the week</Mono>
          <Display className="text-4xl leading-tight">{me.week.artist}</Display>
          <Mono>{me.week.stat}</Mono>
        </View>
      </View>

      <View className="flex-1 justify-between gap-6 px-6 pb-8 pt-6">
        <View className="gap-1">
          <Mono>Plays this week</Mono>
          <Body className="text-lg">
            {me.week.plays} plays — this is what carried you through it.
          </Body>
        </View>

        <Button size="lg" onPress={handleShare} disabled={busy}>
          <Text>{busy ? 'Preparing…' : 'Share my week'}</Text>
        </Button>
      </View>

      {/* Off-screen — exists only so `captureRef` has something to snapshot. */}
      <View
        style={{ position: 'absolute', top: -9999, left: -9999 }}
        pointerEvents="none"
      >
        <ShareCard ref={shareCardRef} variant="solo" me={me} />
      </View>
    </SafeAreaView>
  );
}
