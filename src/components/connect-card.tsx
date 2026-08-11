import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Body, Mono } from '@/components/ui/typography';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';

type ConnectCardProps = {
  title: string;
  reassurance: string;
  connecting: boolean;
  disabled?: boolean;
  /**
   * Not built yet, and says so. Distinct from `disabled`, which means "not
   * right now" — this one is inert by design and must never look like a
   * button that failed.
   */
  comingSoon?: boolean;
  onPress: () => void;
};

/** Tapping fills the card with Signal rose — the mock "connect" moment. */
function ConnectCard({
  title,
  reassurance,
  connecting,
  disabled,
  comingSoon,
  onPress,
}: ConnectCardProps) {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const fill = useSharedValue(0);

  React.useEffect(() => {
    fill.value = withTiming(connecting ? 1 : 0, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [connecting, fill]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || comingSoon}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-card',
        !comingSoon && 'active:opacity-90',
        // Dimmed, but not as far as a disabled card — this one is legible on
        // purpose, since the label is the whole point of showing it.
        comingSoon && 'opacity-60',
        disabled && !connecting && !comingSoon && 'opacity-40'
      )}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.primary },
          fillStyle,
        ]}
      />
      <View className="gap-2 p-5">
        <View className="flex-row items-center justify-between gap-3">
          <Body className={connecting ? 'text-primary-foreground' : 'text-foreground'}>{title}</Body>
          {comingSoon ? <Mono>Coming soon</Mono> : null}
        </View>
        <Body className={cn('text-sm', connecting ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
          {reassurance}
        </Body>
        {connecting ? <Mono className="text-primary-foreground">Connecting…</Mono> : null}
      </View>
    </Pressable>
  );
}

export { ConnectCard };
export type { ConnectCardProps };
