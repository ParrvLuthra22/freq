import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { FreqDial } from '@/components/ui/freq-dial';
import { Body, Mono } from '@/components/ui/typography';
import { getExplanation } from '@/lib/ai';
import { getMe, type DiscoverUser } from '@/lib/seed';
import { toggleLike } from '@/lib/store';

const LIKE_THRESHOLD = 90;
const MAX_DRAG = 130;

type DiscoveryCardProps = {
  user: DiscoverUser;
};

/** Hinge-style: you like the card or react to a specific thing (chip / song) — never a Tinder throw. */
function DiscoveryCard({ user }: DiscoveryCardProps) {
  const router = useRouter();
  const topReason = user.match.reasons[0];
  const [pulseTrigger, setPulseTrigger] = React.useState(0);
  const [explanation, setExplanation] = React.useState<string | null>(null);
  const translateX = useSharedValue(0);

  // §6.2 — compatibility explanation, cached per pair. The reason chip above
  // renders instantly from local data; this fills in a beat later.
  React.useEffect(() => {
    let cancelled = false;
    const me = getMe();
    getExplanation(`${me.id}:${user.id}`, {
      meName: me.name,
      matchName: user.name,
      reasons: user.match.reasons,
      sharedArtists: user.match.sharedArtists,
      sharedSong: user.match.sharedSong,
    }).then((result) => {
      if (!cancelled) setExplanation(result.text);
    });
    return () => {
      cancelled = true;
    };
  }, [user.id, user.name, user.match.reasons, user.match.sharedArtists, user.match.sharedSong]);

  const goToSync = React.useCallback(() => {
    router.push(`/sync/${user.id}`);
  }, [router, user.id]);

  const like = React.useCallback(() => {
    setPulseTrigger((n) => n + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Persist before navigating so the card is spent from today's drop even if
    // the user backs out of the sync moment.
    toggleLike(user.id);
    setTimeout(goToSync, 260);
  }, [goToSync, user.id]);

  const pan = Gesture.Pan()
    .activeOffsetX([-1000, 10])
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      'worklet';
      // Rubber-band resistance, rightward only — a nudge, not a throw.
      const raw = Math.max(0, event.translationX);
      translateX.value = MAX_DRAG * (1 - Math.exp(-raw / MAX_DRAG));
    })
    .onEnd(() => {
      'worklet';
      if (translateX.value > LIKE_THRESHOLD) {
        translateX.value = withTiming(0, { duration: 200 });
        runOnJS(like)();
      } else {
        translateX.value = withSpring(0, { damping: 16 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${translateX.value / 18}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={cardStyle}>
        <Card>
          <CardContent className="gap-4 pt-6">
            <View className="flex-row items-center gap-4">
              <Avatar name={user.name} gradient={user.avatarGradient} size={64} />
              <View className="flex-1">
                <Body className="text-lg">
                  {user.name}, {user.age}
                </Body>
                <Mono>{user.archetype.name}</Mono>
              </View>
              <FreqDial score={user.match.score} size={64} pulseTrigger={pulseTrigger} />
            </View>

            <Pressable
              onPress={like}
              className="flex-row self-start rounded-full border border-accent bg-accent/10 px-4 py-2 active:opacity-70">
              <Mono className="text-accent">{topReason}</Mono>
            </Pressable>

            {explanation ? <Body className="text-sm text-muted-foreground">{explanation}</Body> : null}

            {user.match.sharedSong ? (
              <Pressable
                onPress={like}
                className="flex-row items-center justify-between rounded-xl border border-border bg-background px-4 py-3 active:opacity-70">
                <View className="flex-1 gap-0.5 pr-3">
                  <Mono>Shared song</Mono>
                  <Body className="text-sm">
                    {user.match.sharedSong.title} — {user.match.sharedSong.artist}
                  </Body>
                </View>
                <Mono className="text-accent">React</Mono>
              </Pressable>
            ) : (
              <View className="rounded-xl border border-border px-4 py-3">
                <Mono>Shared song</Mono>
                <Body className="text-sm text-muted-foreground">
                  None yet — but there&apos;s something here.
                </Body>
              </View>
            )}
          </CardContent>
        </Card>
      </Animated.View>
    </GestureDetector>
  );
}

export { DiscoveryCard };
export type { DiscoveryCardProps };
