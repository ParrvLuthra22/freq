import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwipeCard, type Decision } from '@/components/swipe-card';
import { Body, Display, Mono } from '@/components/ui/typography';
import { getDeck } from '@/lib/seed';
import { confirmMatch, like, pass, usePersistedState } from '@/lib/store';

/** How long a non-mutual like waits before coming back. The pause is the point. */
const MATCH_DELAY = 4200;

export default function DiscoverScreen() {
  const { likedIds, passedIds } = usePersistedState();
  const [flipSignal, setFlipSignal] = React.useState(0);

  const deck = React.useMemo(
    () => getDeck([...likedIds, ...passedIds]),
    [likedIds, passedIds]
  );

  // Pending likes resolve on a timer, so they have to be cancelled if the screen
  // goes away — otherwise a match lands against an unmounted component.
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  React.useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    []
  );

  const decide = React.useCallback((userId: string, decision: Decision) => {
    Haptics.impactAsync(
      decision === 'like' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );

    if (decision === 'pass') {
      pass(userId);
      return;
    }

    if (like(userId)) {
      // They had already swiped right — no reason to make anyone wait.
      timers.current.push(setTimeout(() => router.push(`/reveal/${userId}`), 200));
    } else {
      timers.current.push(setTimeout(() => confirmMatch(userId), MATCH_DELAY));
    }
  }, []);

  const top = deck[0];
  const visible = deck.slice(0, 3);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-end justify-between gap-3 px-6 pb-4 pt-2">
        <View className="gap-1">
          <Mono>
            {deck.length > 0 ? `${deck.length} in range` : 'Deck empty'}
          </Mono>
          <Display className="text-3xl leading-tight">In range</Display>
          <Display italic className="text-3xl leading-tight text-accent">
            this week.
          </Display>
        </View>
        <Mono className="max-w-[110px] text-right">Tap to flip · drag to decide</Mono>
      </View>

      {top ? (
        <View className="flex-1 items-center gap-5 px-6">
          {/* Capped so the deck stays card-shaped on a tablet or a wide preview
              rather than stretching into a letterbox. */}
          <View className="w-full flex-1" style={{ maxWidth: 380, maxHeight: 560 }}>
            {/* Reversed so the top card paints last and sits above the stack. */}
            {visible
              .slice()
              .reverse()
              .map((user) => (
                <SwipeCard
                  key={user.id}
                  user={user}
                  depth={visible.indexOf(user)}
                  flipSignal={user.id === top.id ? flipSignal : 0}
                  onDecide={(decision) => decide(user.id, decision)}
                />
              ))}
          </View>

          <View className="flex-row items-center justify-center gap-6 pb-2">
            <Pressable
              onPress={() => decide(top.id, 'pass')}
              className="h-14 w-14 items-center justify-center rounded-full border border-border active:opacity-70">
              <Body className="text-xl text-muted-foreground">✕</Body>
            </Pressable>
            <Pressable
              onPress={() => decide(top.id, 'like')}
              className="h-[70px] w-[70px] items-center justify-center rounded-full bg-primary active:opacity-80">
              <Mono style={{ color: '#100F0D' }}>LIKE</Mono>
            </Pressable>
            <Pressable
              onPress={() => setFlipSignal((n) => n + 1)}
              className="h-14 w-14 items-center justify-center rounded-full border border-border active:opacity-70">
              <Mono>FLIP</Mono>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center gap-3 px-10 pb-16">
          <Display className="text-center text-3xl leading-tight">That&apos;s everyone</Display>
          <Display italic className="text-center text-3xl leading-tight text-accent">
            for today.
          </Display>
          <Body className="pt-1 text-center text-muted-foreground">
            Chosen on overlap, not on how long you can keep scrolling. Come back when the light
            changes.
          </Body>
          <Pressable
            onPress={() => router.push('/likes')}
            className="mt-2 rounded-xl border border-border px-5 py-3 active:opacity-70">
            <Mono>Who liked you →</Mono>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
