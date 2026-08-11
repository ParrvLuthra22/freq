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
import { getPersonality } from '@/lib/ai';
import { getMe, setMeArchetype, type Archetype } from '@/lib/seed';
import { completeOnboarding } from '@/lib/store';

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
  const [archetype, setArchetype] = React.useState<Archetype | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setPhase('lines'), DIAL_DURATION);
    return () => clearTimeout(timer);
  }, []);

  // Fires alongside the animation, not after it — the AI call and the ~3.5s
  // orchestrated sequence run in parallel so neither one blocks the other.
  React.useEffect(() => {
    let cancelled = false;
    getPersonality({
      name: me.name,
      topArtists: me.topArtists.map((a) => a.name),
      tags: me.tags,
      listeningHours: me.listeningHours,
      energy: me.energy,
    }).then((result) => {
      if (cancelled) return;
      const resolved: Archetype = { name: result.archetype, description: result.description };
      setMeArchetype(resolved);
      setArchetype(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [me.name, me.topArtists, me.tags, me.listeningHours, me.energy]);

  const handleLinesDone = React.useCallback(() => setPhase('reveal'), []);
  const currentLine = useStatusLines(phase === 'lines', handleLinesDone);

  // Reveal waits on whichever finishes later: the animation floor, or the AI
  // call (which always resolves — getPersonality falls back locally on error).
  const ready = phase === 'reveal' && archetype !== null;

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

        {ready ? (
          <View className="w-full gap-6">
            <Animated.View entering={ZoomIn.duration(450)}>
              <Card>
                <CardHeader>
                  <Mono>Your archetype</Mono>
                  <CardTitle>{archetype.name}</CardTitle>
                  <CardDescription>{archetype.description}</CardDescription>
                </CardHeader>
              </Card>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(400).duration(400)}>
              <Button
                size="lg"
                onPress={() => {
                  completeOnboarding();
                  router.replace('/freq');
                }}>
                <Text>Enter FREQ</Text>
              </Button>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
