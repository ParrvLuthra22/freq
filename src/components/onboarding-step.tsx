import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
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

/**
 * One editorial question per screen, steady CTA at the bottom.
 *
 * The keyboard handling here is the whole reason this is not just a `View`.
 * Every step with a text field had the same two problems on a device:
 *
 * 1. The keyboard covered the Next button, so there was no way forward from
 *    the age or name step at all.
 * 2. Even where the button peeked out, the first tap only dismissed the
 *    keyboard — a tap outside a focused input is consumed by the dismiss
 *    unless the scroll view is told otherwise, which reads as a dead button.
 *
 * `KeyboardAvoidingView` fixes the first, `keyboardShouldPersistTaps="handled"`
 * the second. The content also becomes scrollable so a short screen can still
 * reach its own field once the keyboard has taken half the height.
 */
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // iOS needs the container padded by the keyboard's height; Android
        // already resizes the window (softwareKeyboardLayoutMode: resize), so
        // adding padding there would double-count and leave a gap.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            gap: 24,
            paddingHorizontal: 24,
          }}
          // Without this the first tap on Next is eaten by the keyboard
          // dismiss, which is indistinguishable from a broken button.
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>

        <View className="px-6 pb-8 pt-4">
          <Button size="lg" onPress={onNext} disabled={nextDisabled}>
            <Text>{nextLabel}</Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export { OnboardingStep };
export type { OnboardingStepProps };
