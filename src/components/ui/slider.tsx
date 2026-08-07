import * as React from 'react';
import { PanResponder, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

/**
 * A minimal 0–100 drag slider built on React Native's core Responder System
 * rather than Reanimated. This project's Reanimated install has already shown
 * flaky animation behavior on web (see `notification-toast.tsx`'s history),
 * and a slider's entire job is tracking a finger in real time — exactly where
 * that would hurt most. PanResponder is older and plainer, but it works the
 * same way on every platform this app ships to, including web.
 */

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 24;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

type SliderProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

function Slider({ value, onChange, disabled = false }: SliderProps) {
  const [width, setWidth] = React.useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const handleTouch = (e: GestureResponderEvent) => {
    if (width <= 0) return;
    const ratio = clamp(e.nativeEvent.locationX / width, 0, 1);
    onChange(Math.round(ratio * 100));
  };

  // Recreated every render on purpose, rather than memoized behind a ref: it
  // only ever closes over this render's own `width`/`onChange`, so there is
  // no stale-closure risk to guard against, and PanResponder.create is cheap
  // enough that recreating it costs nothing a real drag would ever notice.
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: handleTouch,
    onPanResponderMove: handleTouch,
  });

  const ratio = clamp(value, 0, 100) / 100;

  return (
    <View onLayout={onLayout} className="justify-center py-4" {...panResponder.panHandlers}>
      <View className="rounded-full bg-border" style={{ height: TRACK_HEIGHT }}>
        <View className="rounded-full bg-accent" style={{ height: TRACK_HEIGHT, width: `${ratio * 100}%` }} />
      </View>
      <View
        pointerEvents="none"
        className="absolute rounded-full border-2 border-accent bg-card"
        style={{
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          left: clamp(ratio * width - THUMB_SIZE / 2, 0, Math.max(0, width - THUMB_SIZE)),
          top: '50%',
          marginTop: -THUMB_SIZE / 2,
        }}
      />
    </View>
  );
}

export { Slider };
