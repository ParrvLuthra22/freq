import * as React from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Mono } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import type { Energy } from '@/lib/seed';

const ROWS: { key: keyof Energy; label: string }[] = [
  { key: 'night', label: 'Night' },
  { key: 'emotional', label: 'Emotional' },
  { key: 'highEnergy', label: 'High-energy' },
  { key: 'exploratory', label: 'Exploratory' },
];

function EnergyBar({ label, value }: { label: string; value: number }) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(value, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [value, progress]);

  const style = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Mono className="text-foreground">{label}</Mono>
        <Mono>{Math.round(value)}</Mono>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-muted">
        <Animated.View className="h-full rounded-full bg-accent" style={style} />
      </View>
    </View>
  );
}

type EnergyBarsProps = {
  energy: Energy;
  className?: string;
};

/** The energy viz — night / emotional / high-energy / exploratory, growing on mount. */
function EnergyBars({ energy, className }: EnergyBarsProps) {
  return (
    <View className={cn('gap-4', className)}>
      {ROWS.map(({ key, label }) => (
        <EnergyBar key={key} label={label} value={energy[key]} />
      ))}
    </View>
  );
}

export { EnergyBars };
export type { EnergyBarsProps };
