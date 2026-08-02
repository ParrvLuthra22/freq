import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Mono } from '@/components/ui/typography';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * The 24-hour listening rhythm, drawn as a curve.
 *
 * The seed carries an hour histogram per person that nothing rendered until now.
 * Two curves overlaid is the whole "both of you are awake at 2am" idea made
 * visible — which is far more convincing than the sentence alone.
 */

const HOUR_TICKS = [0, 6, 12, 18] as const;

function hourLabel(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

/**
 * Smooth the histogram into a curve with Catmull-Rom control points.
 *
 * Straight segments between 24 bins read as a jagged chart; the brand is
 * editorial and the app already leans on a sine-wave motif, so the rhythm
 * should flow rather than spike.
 */
function buildCurve(values: number[], width: number, height: number, closed: boolean): string {
  const n = values.length;
  if (n === 0 || width === 0) return '';

  const max = Math.max(...values, 1);
  const stepX = width / (n - 1);
  const point = (i: number) => {
    const clamped = Math.min(n - 1, Math.max(0, i));
    return {
      x: clamped * stepX,
      // Leave a little headroom so the peak never clips the top edge.
      y: height - (values[clamped] / max) * (height * 0.92),
    };
  };

  let d = `M ${point(0).x.toFixed(2)} ${point(0).y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = point(i - 1);
    const p1 = point(i);
    const p2 = point(i + 1);
    const p3 = point(i + 2);

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  if (closed) d += ` L ${width.toFixed(2)} ${height} L 0 ${height} Z`;
  return d;
}

type RhythmChartProps = {
  /** 24 bins, one per hour. Yours. */
  mine: number[];
  /** 24 bins for the other person. Omit to render a single curve. */
  theirs?: number[];
  /** Hours where you both run hot — drawn as soft vertical bands. */
  overlapHours?: number[];
  height?: number;
  /** Legend names. Only shown when comparing. */
  theirName?: string;
  className?: string;
};

function RhythmChart({
  mine,
  theirs,
  overlapHours = [],
  height = 120,
  theirName,
  className,
}: RhythmChartProps) {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const [width, setWidth] = React.useState(0);

  const comparing = Array.isArray(theirs) && theirs.length > 0;

  // Signal rose against ash, not champagne: champagne and ash are both muted
  // beiges and the two curves become genuinely hard to tell apart. Rose also
  // matches the dial, so "their" colour stays consistent across the screen.
  //
  // Standing alone the curve is the subject rather than a reference line, so it
  // takes the accent and drops the dash — as ash it read dimmer than the
  // waveform dividers sitting either side of it.
  const mineColor = comparing ? theme.mutedForeground : theme.accent;
  const theirsColor = theme.primary;

  return (
    <View className={cn('gap-2', className)}>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="rhythmFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theirsColor} stopOpacity={0.28} />
                <Stop offset="1" stopColor={theirsColor} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>

            {/* Shared peak hours, behind the curves. */}
            {overlapHours.map((hour) => (
              <Rect
                key={hour}
                x={(hour / 23) * width - 4}
                y={0}
                width={8}
                height={height}
                fill={theirsColor}
                opacity={0.1}
                rx={4}
              />
            ))}

            {comparing ? (
              <Path d={buildCurve(theirs!, width, height, true)} fill="url(#rhythmFill)" />
            ) : null}

            <Path
              d={buildCurve(mine, width, height, false)}
              stroke={mineColor}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              // Dashed when comparing so the two curves stay tellable apart
              // without relying on colour alone.
              strokeDasharray={comparing ? '3 4' : undefined}
            />

            {comparing ? (
              <Path
                d={buildCurve(theirs!, width, height, false)}
                stroke={theirsColor}
                strokeWidth={1.75}
                fill="none"
                strokeLinecap="round"
              />
            ) : null}
          </Svg>
        ) : null}
      </View>

      <View className="flex-row justify-between">
        {HOUR_TICKS.map((hour) => (
          <Mono key={hour}>{hourLabel(hour)}</Mono>
        ))}
        <Mono>12a</Mono>
      </View>

      {comparing ? (
        <View className="flex-row gap-4 pt-1">
          <View className="flex-row items-center gap-2">
            <View style={{ width: 14, height: 2, backgroundColor: mineColor }} />
            <Mono>You</Mono>
          </View>
          <View className="flex-row items-center gap-2">
            <View style={{ width: 14, height: 2, backgroundColor: theirsColor }} />
            <Mono>{theirName ?? 'Them'}</Mono>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export { RhythmChart };
export type { RhythmChartProps };
