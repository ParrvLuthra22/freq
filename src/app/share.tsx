import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as React from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareCard } from '@/components/share-card';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Mono } from '@/components/ui/typography';
import { getMe, getUserById } from '@/lib/seed';

export default function ShareScreen() {
  const { variant, id } = useLocalSearchParams<{ variant?: string; id?: string }>();
  const isPair = variant === 'pair';
  const me = getMe();
  const match = isPair && id ? getUserById(id) : undefined;

  const cardRef = React.useRef<View>(null);
  const [busy, setBusy] = React.useState(false);

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your FREQ' });
      }
    } catch (error) {
      // Sharing can be cancelled or unavailable (e.g. no share target, web's stricter
      // Web Share API) — fail quietly rather than leaving the screen in a broken state.
      console.warn('Share failed', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-8 bg-background px-6">
      <Mono>{isPair ? 'You × them' : 'My FREQ'}</Mono>

      <ShareCard ref={cardRef} variant={isPair ? 'pair' : 'solo'} me={me} match={match} />

      <View className="w-full gap-3">
        <Button size="lg" onPress={handleShare} disabled={busy}>
          <Text>{busy ? 'Preparing…' : 'Save / Share'}</Text>
        </Button>
        <Button size="lg" variant="outline" onPress={() => router.back()}>
          <Text>Close</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
