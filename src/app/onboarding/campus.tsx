import { router } from 'expo-router';
import * as React from 'react';
import { TextInput } from 'react-native';

import { OnboardingStep } from '@/components/onboarding-step';
import { Body } from '@/components/ui/typography';

export default function OnboardingCampusScreen() {
  const [campus, setCampus] = React.useState('');

  return (
    <OnboardingStep
      step="Step 3 of 4"
      question="Where do you"
      accent="go?"
      onNext={() => router.push('/onboarding/looking-for')}
      nextDisabled={campus.trim().length === 0}>
      <TextInput
        value={campus}
        onChangeText={setCampus}
        placeholder="NYU"
        placeholderClassName="text-muted-foreground"
        autoFocus
        autoCapitalize="words"
        className="rounded-2xl border border-border bg-card px-4 py-3 font-body text-lg text-foreground"
      />
      <Body className="text-sm text-muted-foreground">
        Campus is private — it&apos;s just how we scope who you see.
      </Body>
    </OnboardingStep>
  );
}
