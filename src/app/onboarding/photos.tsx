import { router } from 'expo-router';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoManager } from '@/components/photo-manager';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';

/**
 * Photos, framed by the promise that makes asking for them reasonable.
 *
 * The reassurance is the point of this screen as much as the upload is: FREQ
 * asks for a face and then refuses to show it to anyone until a match, so
 * saying that plainly here is what earns the upload. Skippable on purpose —
 * a demo visitor should never be blocked behind a camera roll, and a profile
 * with no photo still works everywhere except the reveal.
 */
export default function OnboardingPhotosScreen() {
  const [count, setCount] = React.useState(0);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-6 pb-8 pt-6">
        <Mono>Step 5 of 5</Mono>
        <View>
          <Display className="text-4xl leading-tight">Add a face</Display>
          <Display italic className="text-4xl leading-tight text-accent">
            for later.
          </Display>
        </View>
        <Body className="text-muted-foreground">
          Nobody sees these until you both swipe right. Before that, your card
          shows an album sleeve and a question mark — that part is not a
          setting, it&apos;s how FREQ works.
        </Body>

        <PhotoManager onCountChange={setCount} />

        <Body className="text-sm text-muted-foreground">
          Up to six. The one marked main is what unseals at a match.
        </Body>
      </ScrollView>

      <View className="gap-2 px-6 pb-8 pt-2">
        <Button size="lg" onPress={() => router.push('/onboarding/connect')}>
          <Text>{count > 0 ? 'Next' : 'Skip for now'}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
