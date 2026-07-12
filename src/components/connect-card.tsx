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
  onPress: () => void;
};

/** Tapping fills the card with Signal rose — the mock "connect" moment. */
function ConnectCard({ title, reassurance, connecting, disabled, onPress }: ConnectCardProps) {
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
      disabled={disabled}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-card active:opacity-90',
        disabled && !connecting && 'opacity-40'
      )}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.primary },
          fillStyle,
        ]}
      />
      <View className="gap-2 p-5">
        <Body className={connecting ? 'text-primary-foreground' : 'text-foreground'}>{title}</Body>
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
