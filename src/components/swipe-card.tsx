import { BlurView } from 'expo-blur';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { AlbumArt } from '@/components/ui/album-art';
import { FreqDial } from '@/components/ui/freq-dial';
import { Body, Display, Mono } from '@/components/ui/typography';
import { THEME } from '@/lib/theme';
import type { DiscoverUser } from '@/lib/seed';

/** Past this many points sideways, letting go decides rather than springs back. */
const DECIDE_AT = 96;
/** How far the card flies before it is removed. */
const FLY_OUT = 520;

export type Decision = 'like' | 'pass';

type SwipeCardProps = {
  user: DiscoverUser;
  /** 0 is the top card. Cards behind it are scaled down and inert. */
  depth: number;
  onDecide: (decision: Decision) => void;
  /** Drives the flip from the deck's buttons as well as a tap. */
  flipSignal?: number;
};

/**
 * One card in the deck.
 *
 * Two faces: their week, and your overlap. Their face is deliberately not one of
 * them — the avatar is their sleeve behind a blur until a swipe is mutual, which
 * is the whole premise of v2.
 */
function SwipeCard({ user, depth, onDecide, flipSignal = 0 }: SwipeCardProps) {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const isTop = depth === 0;

  const [showOverlap, setShowOverlap] = React.useState(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // A flip requested by the deck's FLIP button, not by tapping the card itself.
  React.useEffect(() => {
    if (flipSignal > 0) setShowOverlap((v) => !v);
  }, [flipSignal]);

  const settle = React.useCallback(
    (decision: Decision) => {
      onDecide(decision);
    },
    [onDecide]
  );

  const pan = Gesture.Pan()
    .enabled(isTop)
    .activeOffsetX([-12, 12])
    .failOffsetY([-24, 24])
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.28;
    })
    .onEnd(() => {
      'worklet';
      const x = translateX.value;
      if (Math.abs(x) > DECIDE_AT) {
        const direction = x > 0 ? 1 : -1;
        translateX.value = withTiming(direction * FLY_OUT, { duration: 260 });
        translateY.value = withTiming(40, { duration: 260 });
        runOnJS(settle)(direction > 0 ? 'like' : 'pass');
      } else {
        translateX.value = withSpring(0, { damping: 18 });
        translateY.value = withSpring(0, { damping: 18 });
      }
    });

  const tap = Gesture.Tap()
    .enabled(isTop)
    .maxDistance(10)
    .onEnd(() => {
      'worklet';
      runOnJS(setShowOverlap)(!showOverlap);
    });

  const gesture = Gesture.Simultaneous(pan, Gesture.Exclusive(tap));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + depth * 10 },
      { rotate: `${translateX.value / 22}deg` },
      { scale: 1 - depth * 0.04 },
    ],
  }));

  const likeStamp = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, DECIDE_AT], [0, 1], 'clamp'),
  }));
  const passStamp = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-DECIDE_AT, -20], [1, 0], 'clamp'),
  }));

  const content = showOverlap ? (
    <OverlapFace user={user} />
  ) : (
    <WeekFace user={user} theme={theme} />
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            inset: 0,
            borderRadius: 22,
            overflow: 'hidden',
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            zIndex: 10 - depth,
          },
          cardStyle,
        ]}>
        {content}

        {isTop ? (
          <>
            <Animated.View
              style={[
                { position: 'absolute', top: 22, left: 20, borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderColor: theme.primary, transform: [{ rotate: '-12deg' }] },
                likeStamp,
              ]}>
              <Mono style={{ color: theme.primary, fontSize: 15 }}>LIKE</Mono>
            </Animated.View>
            <Animated.View
              style={[
                { position: 'absolute', top: 22, right: 20, borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderColor: theme.mutedForeground, transform: [{ rotate: '12deg' }] },
                passStamp,
              ]}>
              <Mono style={{ color: theme.mutedForeground, fontSize: 15 }}>PASS</Mono>
            </Animated.View>
          </>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

/** Face one: the artist they're meeting people through, and a sealed identity. */
function WeekFace({ user, theme }: { user: DiscoverUser; theme: (typeof THEME)['dark'] }) {
  return (
    <View className="flex-1">
      <View style={{ position: 'relative' }}>
        <AlbumArt seed={user.week.artist} shape="square" fill />
        <LinearGradient
          colors={['transparent', 'transparent', theme.background]}
          locations={[0, 0.42, 1]}
          style={{ position: 'absolute', inset: 0 }}
        />
        <View className="absolute inset-x-5 bottom-3 gap-1">
          <Mono style={{ color: theme.accent }}>Their artist of the week</Mono>
          <Display className="text-3xl leading-tight">{user.week.artist}</Display>
          <Mono>{user.week.stat}</Mono>
        </View>
      </View>

      <View className="flex-1 justify-between px-5 pb-5 pt-4">
        <View className="flex-row items-center gap-3">
          <View style={{ width: 46, height: 46 }}>
            <AlbumArt seed={user.id} size={46} shape="circle" />
            {/* Sealed: the sleeve is theirs, the face is not on offer yet. */}
            <BlurView
              intensity={26}
              tint={theme.background === '#100F0D' ? 'dark' : 'light'}
              style={{ position: 'absolute', inset: 0, borderRadius: 23, overflow: 'hidden' }}
            />
            <View
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 23,
                borderWidth: 1,
                borderColor: theme.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Mono style={{ color: theme.foreground }}>?</Mono>
            </View>
          </View>
          <View className="flex-1">
            <Display className="text-xl leading-tight">
              {user.name}, {user.age}
            </Display>
            <Mono>Face hidden until you both swipe</Mono>
          </View>
        </View>

        <View
          className="flex-row items-center justify-between gap-3 pt-3"
          style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
          <Body className="flex-1 text-sm text-muted-foreground">{user.reasonSoft}</Body>
          <Mono style={{ color: theme.primary }}>Overlap →</Mono>
        </View>
      </View>
    </View>
  );
}

/** Face two: the actual overlap, computed rather than asserted. */
function OverlapFace({ user }: { user: DiscoverUser }) {
  return (
    <View className="flex-1 gap-3.5 p-5">
      <View className="flex-row items-center justify-between">
        <Mono>Your overlap</Mono>
        <Mono className="text-accent">← Their week</Mono>
      </View>

      <View className="flex-row items-center gap-4">
        <FreqDial score={user.match.score} size={112} label="Freq" />
        <View className="flex-1 gap-1.5">
          <Display className="text-2xl leading-tight">
            {user.name}, {user.age}
          </Display>
          <Mono>{user.archetype.name}</Mono>
          <View className="self-start rounded-full border border-accent bg-accent/10 px-2.5 py-1.5">
            <Mono className="text-accent">{user.reason}</Mono>
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {user.chips.map((chip) => (
          <View
            key={chip.label}
            className={
              chip.rare
                ? 'rounded-full border border-accent bg-accent/10 px-3 py-1.5'
                : 'rounded-full border border-border px-3 py-1.5'
            }>
            <Mono className={chip.rare ? 'text-accent' : 'text-foreground'}>{chip.label}</Mono>
          </View>
        ))}
      </View>

      <Body className="text-sm leading-relaxed text-muted-foreground">{user.line}</Body>

      <View className="mt-auto gap-2.5">
        {user.song ? (
          <View className="rounded-xl border border-border bg-background px-3.5 py-3">
            <Mono>Shared song</Mono>
            <Body className="pt-0.5 text-sm">
              {user.song.title} — {user.song.artist}
            </Body>
          </View>
        ) : null}
        <View className="flex-row justify-between">
          <Mono>{user.hoursNote}</Mono>
          <Mono>{user.rarityNote}</Mono>
        </View>
      </View>
    </View>
  );
}

export { SwipeCard };
export type { SwipeCardProps };
