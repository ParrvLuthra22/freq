import { router } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectCard } from '@/components/connect-card';
import { Body, Display, Mono } from '@/components/ui/typography';
import { getMe } from '@/lib/seed';

type Service = 'spotify' | 'lastfm';

export default function ConnectMusicScreen() {
  const [connecting, setConnecting] = React.useState<Service | null>(null);

  const handleConnect = (service: Service) => {
    if (connecting) return;
    setConnecting(service);
    // Mock: no real OAuth yet — load the seed profile as "me" and move on.
    getMe();
    setTimeout(() => {
      router.replace('/onboarding/building');
    }, 650);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center gap-6 px-6">
        <Mono>Connect music</Mono>
        <View>
          <Display className="text-4xl leading-tight">Show us what</Display>
          <Display italic className="text-4xl leading-tight text-accent">
            you actually play.
          </Display>
        </View>
        <Body className="text-muted-foreground">
          Spotify primary, Last.fm secondary — pick one to start. We only need one.
        </Body>

        <View className="gap-4 pt-2">
          <ConnectCard
            title="Spotify"
            reassurance="Top artists, top tracks, recent plays — not the playlist names you're pretending are ironic."
            connecting={connecting === 'spotify'}
            disabled={connecting !== null && connecting !== 'spotify'}
            onPress={() => handleConnect('spotify')}
          />
          <ConnectCard
            title="Last.fm"
            reassurance="Every scrobble, unfiltered — the real-time record of what you actually pressed play on."
            connecting={connecting === 'lastfm'}
            disabled={connecting !== null && connecting !== 'lastfm'}
            onPress={() => handleConnect('lastfm')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
