import * as React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Tab icons drawn to the brand rather than pulled from a stock set.
 *
 * Each one says what the tab actually does: overlap for discovery, the FreqDial
 * ring for your own profile, two waves meeting for a sync. Fine 1.5px strokes to
 * match the editorial line weight used across the app.
 */

export type TabIconName = 'discover' | 'freq' | 'sync' | 'likes';

type TabIconProps = {
  name: TabIconName;
  color: string;
  size?: number;
  /** The active tab fills its shape softly so the state reads without a color change alone. */
  focused?: boolean;
};

function TabIcon({ name, color, size = 24, focused = false }: TabIconProps) {
  const fill = focused ? color : 'none';
  const fillOpacity = focused ? 0.18 : 0;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'discover' ? (
        // Two overlapping circles — rare overlap, the whole premise.
        <>
          <Circle
            cx={9}
            cy={12}
            r={5.5}
            stroke={color}
            strokeWidth={1.5}
            fill={fill}
            fillOpacity={fillOpacity}
          />
          <Circle
            cx={15}
            cy={12}
            r={5.5}
            stroke={color}
            strokeWidth={1.5}
            fill={fill}
            fillOpacity={fillOpacity}
          />
        </>
      ) : null}

      {name === 'freq' ? (
        // The dial: an open ring with the same gap as <FreqDial>, plus its centre.
        <>
          <Path
            d="M12 3.5a8.5 8.5 0 1 1-6.01 2.49"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            fill={fill}
            fillOpacity={fillOpacity}
          />
          <Circle cx={12} cy={12} r={2.25} fill={color} />
        </>
      ) : null}

      {name === 'likes' ? (
        // A sleeve with someone already looking at it.
        <>
          <Circle
            cx={11}
            cy={13}
            r={7.5}
            stroke={color}
            strokeWidth={1.5}
            fill={fill}
            fillOpacity={fillOpacity}
          />
          <Circle cx={19.5} cy={5.5} r={2.8} fill={color} />
        </>
      ) : null}

      {name === 'sync' ? (
        // Two waveforms meeting in phase.
        <>
          <Path
            d="M2 9c2.2 0 2.2 6 4.4 6S8.6 9 10.8 9"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <Path
            d="M13.2 15c2.2 0 2.2-6 4.4-6S19.8 15 22 15"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={focused ? 1 : 0.55}
          />
        </>
      ) : null}
    </Svg>
  );
}

export { TabIcon };
