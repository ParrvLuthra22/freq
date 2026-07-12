import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FreqDial } from '@/components/ui/freq-dial';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import { getExplanation, getIcebreakers } from '@/lib/ai';
import { getMe, type DiscoverUser } from '@/lib/seed';
import { formatList } from '@/lib/utils';

type SyncMomentProps = {
  user: DiscoverUser;
  /** Pass this when reached from Discovery, so there's a way back that isn't a tab switch. */
  onBack?: () => void;
};

/** The emotional peak — replaces "It's a match!" */
function SyncMoment({ user, onBack }: SyncMomentProps) {
  const router = useRouter();
  const me = React.useMemo(() => getMe(), []);
  const pairKey = `${me.id}:${user.id}`;

  const [explanation, setExplanation] = React.useState(
    user.match.sharedArtists.length > 0
      ? `You both know ${formatList(user.match.sharedArtists)}.`
      : "A stretch, but a promising one — you'll have to find out why."
  );
  const [openers, setOpeners] = React.useState<string[]>([]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  // §6.2 explanation + §6.3 icebreakers — both fire here, cached per pair.
  React.useEffect(() => {
    let cancelled = false;
    const pairInput = {
      meName: me.name,
      matchName: user.name,
      reasons: user.match.reasons,
      sharedArtists: user.match.sharedArtists,
      sharedSong: user.match.sharedSong,
    };
    getExplanation(pairKey, pairInput).then((result) => {
      if (!cancelled) setExplanation(result.text);
    });
    getIcebreakers(pairKey, pairInput).then((result) => {
      if (!cancelled) setOpeners(result.openers);
    });
    return () => {
      cancelled = true;
    };
  }, [pairKey, me.name, user.name, user.match.reasons, user.match.sharedArtists, user.match.sharedSong]);

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

        <Body className="px-4 text-center text-muted-foreground">{explanation}</Body>

        {user.match.sharedSong ? (
          <Card className="w-full">
            <CardHeader>
              <Mono>Your song</Mono>
              <CardTitle>{user.match.sharedSong.title}</CardTitle>
              <CardDescription>{user.match.sharedSong.artist}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {openers.length > 0 ? (
          <View className="w-full gap-2">
            <Mono>Icebreakers</Mono>
            {openers.map((opener) => (
              <Pressable
                key={opener}
                onPress={() =>
                  router.push({ pathname: '/chat/[id]', params: { id: user.id, opener } })
                }
                className="rounded-xl border border-border bg-card px-4 py-3 active:opacity-70">
                <Body className="text-sm">{opener}</Body>
              </Pressable>
            ))}
          </View>
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
