import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Display, Mono } from '@/components/ui/typography';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function withAlpha(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type FreqDialProps = {
  /** 0–100. The dial clamps and animates to this value on mount and whenever it changes. */
  score: number;
  size?: number;
  strokeWidth?: number;
  /** Small mono caption under the number, e.g. "MATCH". Omit for a bare score. */
  label?: string;
  duration?: number;
  /** Increment this (e.g. on "like") to fire a brief signal-rose pulse. Ignored on mount. */
  pulseTrigger?: number;
  /**
   * 'auto' (default) follows the app's current scheme. 'dark' forces the brand-dark
   * palette regardless — for contexts like the share card, which is a fixed on-brand
   * asset and shouldn't flip to cream just because the viewer is in light mode.
   */
  theme?: 'auto' | 'dark';
  className?: string;
};

function FreqDial({
  score,
  size = 200,
  strokeWidth,
  label,
  duration = 1200,
  pulseTrigger,
  theme: themeOverride = 'auto',
  className,
}: FreqDialProps) {
  const { colorScheme } = useColorScheme();
  const resolvedScheme = themeOverride === 'dark' ? 'dark' : (colorScheme ?? 'dark');
  const theme = THEME[resolvedScheme];
  const forcedDark = themeOverride === 'dark';
  const clamped = Math.max(0, Math.min(100, score));

  const stroke = strokeWidth ?? Math.max(6, Math.round(size * 0.06));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useSharedValue(0);
  const glowScale = useSharedValue(0.85);
  const glowOpacity = useSharedValue(0);
  const bounce = useSharedValue(1);
  const isFirstPulse = React.useRef(true);

  React.useEffect(() => {
    progress.value = withTiming(clamped / 100, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, duration, progress]);

  React.useEffect(() => {
    if (pulseTrigger === undefined) return;
    if (isFirstPulse.current) {
      isFirstPulse.current = false;
      return;
    }
    glowScale.value = 0.85;
    glowOpacity.value = 0.55;
    glowScale.value = withTiming(1.45, { duration: 550, easing: Easing.out(Easing.quad) });
    glowOpacity.value = withTiming(0, { duration: 550, easing: Easing.out(Easing.quad) });
    bounce.value = withSequence(
      withTiming(1.07, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseTrigger]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounce.value }],
  }));

  return (
    <Animated.View
      className={className}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, bounceStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.primary,
          },
          glowStyle,
        ]}
      />
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={withAlpha(theme.border, 0.35)}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View className="absolute items-center" pointerEvents="none">
        <Display
          className={cn(
            `text-[${Math.round(size * 0.26)}px] leading-none`,
            forcedDark ? 'text-ivory' : 'text-foreground'
          )}>
          {Math.round(clamped)}
        </Display>
        {label ? <Mono className={cn('mt-1', forcedDark && 'text-ash')}>{label}</Mono> : null}
      </View>
    </Animated.View>
  );
}

export { FreqDial };
export type { FreqDialProps };
