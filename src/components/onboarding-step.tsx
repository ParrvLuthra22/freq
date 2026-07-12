import * as React from 'react';
import { View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Display, Mono } from '@/components/ui/typography';
import { Waveform } from '@/components/ui/waveform';

type OnboardingStepProps = {
  step: string;
  question: string;
  accent?: string;
  children?: React.ReactNode;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
};

/** One editorial question per screen — slide+fade in, steady CTA at the bottom. */
function OnboardingStep({
  step,
  question,
  accent,
  children,
  onNext,
  nextDisabled,
  nextLabel = 'Next',
}: OnboardingStepProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <Animated.View
        entering={FadeInRight.duration(380)}
        exiting={FadeOutLeft.duration(220)}
        style={{ flex: 1, justifyContent: 'center', gap: 24, paddingHorizontal: 24 }}>
        <Mono>{step}</Mono>
        <View>
          <Display className="text-4xl leading-tight">{question}</Display>
          {accent ? (
            <Display italic className="text-4xl leading-tight text-accent">
              {accent}
            </Display>
          ) : null}
        </View>
        <Waveform />
        {children ? <View className="gap-4">{children}</View> : null}
      </Animated.View>
      <View className="px-6 pb-8 pt-4">
        <Button size="lg" onPress={onNext} disabled={nextDisabled}>
          <Text>{nextLabel}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

export { OnboardingStep };
export type { OnboardingStepProps };
