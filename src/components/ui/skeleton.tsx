import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';

type SkeletonProps = {
  /** Sizing/shape as usual — e.g. "h-4 w-24 rounded-lg", "h-40 w-full rounded-2xl". */
  className?: string;
};

/**
 * A pulsing placeholder block — the shape of what's still loading, not a
 * spinner that says nothing about it. The animated opacity lives on an inner
 * node with no className of its own: an Animated.View drops any className the
 * moment it also carries a `style` prop (see energy-bars.tsx's own note on
 * this), so the outer node owns all the shape/sizing and the inner one owns
 * only the animation.
 */
function Skeleton({ className }: SkeletonProps) {
  const { colorScheme } = useColorScheme();
  const color = THEME[colorScheme ?? 'dark'].border;
  const opacity = useSharedValue(0.35);

  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(0.8, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View className={cn('overflow-hidden', className)}>
      <Animated.View style={[{ flex: 1, backgroundColor: color }, animatedStyle]} />
    </View>
  );
}

export { Skeleton };
