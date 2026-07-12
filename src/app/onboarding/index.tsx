import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import { Waveform } from '@/components/ui/waveform';

export default function OnboardingWelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-end gap-6 px-6 pb-10">
        <Mono>Freq</Mono>
        <Display className="text-5xl leading-tight">
          You are what you{' '}
          <Display italic className="text-5xl leading-tight text-accent">
            play.
          </Display>
        </Display>
        <Body className="text-muted-foreground">
          One question per screen. Name, age, campus, what you&apos;re looking for — then we
          read what you actually listen to.
        </Body>
        <Waveform />
        <Button size="lg" onPress={() => router.push('/onboarding/name')}>
          <Text>Get started</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
