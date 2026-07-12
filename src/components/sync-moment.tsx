import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FreqDial } from '@/components/ui/freq-dial';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import type { DiscoverUser } from '@/lib/seed';

function formatList(items: string[]) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

type SyncMomentProps = {
  user: DiscoverUser;
  /** Pass this when reached from Discovery, so there's a way back that isn't a tab switch. */
  onBack?: () => void;
};

/** The emotional peak — replaces "It's a match!" */
function SyncMoment({ user, onBack }: SyncMomentProps) {
  const router = useRouter();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="flex-grow items-center justify-center gap-6 px-6 py-12">
        <FreqDial score={user.match.score} size={220} label="Sync" />

        <View className="items-center">
          <Display className="text-center text-4xl leading-tight">You&apos;re in</Display>
          <Display italic className="text-center text-4xl leading-tight text-accent">
            sync.
          </Display>
        </View>

        <Body className="px-4 text-center text-muted-foreground">
          {user.match.sharedArtists.length > 0
            ? `You both know ${formatList(user.match.sharedArtists)}.`
            : "A stretch, but a promising one — you'll have to find out why."}
        </Body>

        {user.match.sharedSong ? (
          <Card className="w-full">
            <CardHeader>
              <Mono>Your song</Mono>
              <CardTitle>{user.match.sharedSong.title}</CardTitle>
              <CardDescription>{user.match.sharedSong.artist}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <View className="w-full gap-3 pt-2">
          <Button size="lg" onPress={() => router.push(`/chat/${user.id}`)}>
            <Text>Say something</Text>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/share', params: { variant: 'pair', id: user.id } })
            }>
            <Text>Share this sync</Text>
          </Button>
          {onBack ? (
            <Button size="lg" variant="outline" onPress={onBack}>
              <Text>Keep exploring</Text>
            </Button>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export { SyncMoment };
export type { SyncMomentProps };
