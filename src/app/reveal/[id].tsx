import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumArt } from '@/components/ui/album-art';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import { getUserById } from '@/lib/seed';
import { markRead } from '@/lib/store';
import { THEME } from '@/lib/theme';

/** How long the seal holds before the face opens. Long enough to feel earned. */
const SEAL_MS = 1600;

/** The pulse that runs while a face is still sealed. */
function SealRing({ color }: { color: string }) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    inset: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color,
    opacity: 0.5 * (1 - progress.value),
    transform: [{ scale: 0.7 + progress.value * 1.2 }],
  }));

  return <Animated.View style={style} />;
}

export default function RevealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = getUserById(id);
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];

  const [open, setOpen] = React.useState(false);
  const faceOpacity = useSharedValue(0);
  const faceScale = useSharedValue(0.86);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(true);
      faceOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
      faceScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    }, SEAL_MS);
    return () => clearTimeout(timer);
  }, [faceOpacity, faceScale]);

  const faceStyle = useAnimatedStyle(() => ({
    opacity: faceOpacity.value,
    transform: [{ scale: faceScale.value }],
  }));

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Body className="text-center text-muted-foreground">That profile wandered off.</Body>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-5 px-6 pb-8">
        <Mono className="text-accent">You both swiped right</Mono>

        <View style={{ width: 212, height: 212 }}>
          <AlbumArt seed={user.id} size={212} shape="circle" />

          {!open ? (
            <>
              <BlurView
                intensity={40}
                tint={theme.background === '#100F0D' ? 'dark' : 'light'}
                style={{ position: 'absolute', inset: 0, borderRadius: 106, overflow: 'hidden' }}
              />
              <View className="absolute inset-0 items-center justify-center">
                <Mono style={{ color: theme.foreground }}>Unsealing…</Mono>
              </View>
              <SealRing color={theme.primary} />
            </>
          ) : (
            // Unsealed: the sleeve resolves sharp rather than becoming a face —
            // FREQ never traded on photographs.
            <Animated.View
              style={[{ position: 'absolute', inset: 0, borderRadius: 106, overflow: 'hidden' }, faceStyle]}>
              <AlbumArt seed={user.id} size={212} shape="circle" />
            </Animated.View>
          )}
        </View>

        <View>
          <Display className="text-center text-4xl leading-tight">{user.name} is</Display>
          <Display italic className="text-center text-4xl leading-tight text-accent">
            in sync with you.
          </Display>
        </View>

        <View className="flex-row items-center gap-3">
          <Display className="text-3xl text-accent">{user.match.score}</Display>
          <View>
            <Mono>Freq</Mono>
            <Mono>{user.reason}</Mono>
          </View>
        </View>

        <Body className="max-w-[290px] text-center text-lg italic text-foreground">
          {user.flirt}
        </Body>

        <View className="w-full gap-2.5 pt-2">
          <Button
            size="lg"
            onPress={() => {
              markRead(user.id);
              router.replace(`/chat/${user.id}`);
            }}>
            <Text>Say something</Text>
          </Button>
          <Pressable
            onPress={() => router.replace('/discover')}
            className="h-12 items-center justify-center rounded-xl border border-border active:opacity-70">
            <Body>Keep swiping</Body>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
