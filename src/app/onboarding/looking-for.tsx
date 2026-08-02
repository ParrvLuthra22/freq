import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { OnboardingStep } from '@/components/onboarding-step';
import { Body } from '@/components/ui/typography';
import { saveProfile } from '@/lib/store';
import { cn } from '@/lib/utils';

const OPTIONS = ['Date', 'Friends', 'Rooms'] as const;

export default function OnboardingLookingForScreen() {
  const [choice, setChoice] = React.useState<(typeof OPTIONS)[number] | null>(null);

  return (
    <OnboardingStep
      step="Step 4 of 4"
      question="What are you"
      accent="looking for?"
      onNext={() => {
        saveProfile({ lookingFor: choice });
        router.push('/onboarding/connect');
      }}
      nextDisabled={!choice}>
      <View className="flex-row flex-wrap gap-3">
        {OPTIONS.map((option) => {
          const selected = choice === option;
          return (
            <Pressable
              key={option}
              onPress={() => setChoice(option)}
              className={cn(
                'rounded-full border px-5 py-3 active:opacity-80',
                selected ? 'border-accent bg-accent/10' : 'border-border bg-card'
              )}>
              <Body className={selected ? 'text-accent' : 'text-foreground'}>{option}</Body>
            </Pressable>
          );
        })}
      </View>
    </OnboardingStep>
  );
}
