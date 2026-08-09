import { router } from 'expo-router';
import * as React from 'react';
import { TextInput } from 'react-native';

import { OnboardingStep } from '@/components/onboarding-step';
import { saveProfile } from '@/lib/store';

export default function OnboardingNameScreen() {
  const [name, setName] = React.useState('');

  return (
    <OnboardingStep
      step="Step 1 of 4"
      question="What should we"
      accent="call you?"
      onNext={() => {
        saveProfile({ name: name.trim() });
        router.push('/onboarding/age');
      }}
      nextDisabled={name.trim().length === 0}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your first name"
        placeholderClassName="text-muted-foreground"
        autoFocus
        autoCapitalize="words"
        maxLength={30}
        className="rounded-2xl border border-border bg-card px-4 py-3 font-body text-lg text-foreground"
      />
    </OnboardingStep>
  );
}
