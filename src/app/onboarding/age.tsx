import { router } from 'expo-router';
import * as React from 'react';
import { TextInput } from 'react-native';

import { OnboardingStep } from '@/components/onboarding-step';

export default function OnboardingAgeScreen() {
  const [age, setAge] = React.useState('');
  const parsed = Number(age);
  const valid = age.trim().length > 0 && Number.isInteger(parsed) && parsed >= 18 && parsed <= 99;

  return (
    <OnboardingStep
      step="Step 2 of 4"
      question="How old are"
      accent="you?"
      onNext={() => router.push('/onboarding/campus')}
      nextDisabled={!valid}>
      <TextInput
        value={age}
        onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ''))}
        placeholder="24"
        placeholderClassName="text-muted-foreground"
        autoFocus
        keyboardType="number-pad"
        maxLength={2}
        className="rounded-2xl border border-border bg-card px-4 py-3 font-body text-lg text-foreground"
      />
    </OnboardingStep>
  );
}
