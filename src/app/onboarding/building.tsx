import { router } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FreqDial } from '@/components/ui/freq-dial';
import { Text } from '@/components/ui/text';
import { Mono } from '@/components/ui/typography';
import { getMe } from '@/lib/seed';

const STATUS_LINES = [
  'Reading 2am habits…',
  'Weighing rare taste…',
  'Cross-referencing late nights with early risers…',
];

const DIAL_DURATION = 1300;
const LINE_DURATION = 650;

function useStatusLines(active: boolean, onDone: () => void) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (!active) return;
    if (index >= STATUS_LINES.length) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), LINE_DURATION);
    return () => clearTimeout(timer);
  }, [active, index, onDone]);

  return index < STATUS_LINES.length ? STATUS_LINES[index] : null;
}

/** The Wrapped-style hook — a boring fetch turned into a ~3.5s orchestrated moment. */
export default function BuildingFreqScreen() {
  const me = React.useMemo(() => getMe(), []);
  const energyValues = Object.values(me.energy);
  const signature = Math.round(energyValues.reduce((a, b) => a + b, 0) / energyValues.length);

  const [phase, setPhase] = React.useState<'dial' | 'lines' | 'reveal'>('dial');

  React.useEffect(() => {
    const timer = setTimeout(() => setPhase('lines'), DIAL_DURATION);
    return () => clearTimeout(timer);
  }, []);

  const handleLinesDone = React.useCallback(() => setPhase('reveal'), []);
  const currentLine = useStatusLines(phase === 'lines', handleLinesDone);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-8 px-6">
        <FreqDial score={signature} size={200} duration={DIAL_DURATION} />

        <View className="min-h-12 items-center justify-center px-8">
          {currentLine ? (
            <Animated.View key={currentLine} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              <Mono className="text-center">{currentLine}</Mono>
            </Animated.View>
          ) : null}
        </View>

        {phase === 'reveal' ? (
          <View className="w-full gap-6">
            <Animated.View entering={ZoomIn.duration(450)}>
              <Card>
                <CardHeader>
                  <Mono>Your archetype</Mono>
                  <CardTitle>{me.archetype.name}</CardTitle>
                  <CardDescription>{me.archetype.description}</CardDescription>
                </CardHeader>
              </Card>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(400).duration(400)}>
              <Button size="lg" onPress={() => router.replace('/freq')}>
                <Text>Enter FREQ</Text>
              </Button>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
