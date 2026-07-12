import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { THEME } from '@/lib/theme';

function buildSinePath(periods: number, amplitude: number, midY: number, width: number, steps = 100) {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y = midY + Math.sin((i / steps) * periods * Math.PI * 2) * amplitude;
    d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

type WaveformProps = {
  height?: number;
  periods?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
};

/** A thin sine-wave divider used as texture between sections. */
function Waveform({ height = 24, periods = 3, strokeWidth = 1.5, color, className }: WaveformProps) {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const [width, setWidth] = React.useState(0);

  const amplitude = height * 0.32;
  const midY = height / 2;

  return (
    <View
      className={className}
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Path
            d={buildSinePath(periods, amplitude, midY, width)}
            stroke={color ?? theme.accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

export { Waveform };
export type { WaveformProps };
