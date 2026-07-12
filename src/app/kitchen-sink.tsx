import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FreqDial } from '@/components/ui/freq-dial';
import { Text } from '@/components/ui/text';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Body, Display, Mono } from '@/components/ui/typography';
import { Waveform } from '@/components/ui/waveform';

// Temporary — exercises every design-system component in both themes. Remove once
// the real screens (M2+) cover the same ground.
export default function KitchenSinkScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-8 px-6 pb-16 pt-4">
        <View className="flex-row items-center justify-between">
          <Mono>Kitchen sink</Mono>
          <ThemeToggle />
        </View>

        <View className="gap-2">
          <Mono>Typography</Mono>
          <Display>You are what you</Display>
          <Display italic className="text-accent">
            play.
          </Display>
          <Body className="text-muted-foreground">
            Geist for everything functional — sentence case, never all caps.
          </Body>
          <Mono>score · 92 · rare overlap</Mono>
        </View>

        <Waveform />

        <View className="gap-2">
          <Mono>FreqDial</Mono>
          <View className="flex-row flex-wrap items-center justify-around gap-6">
            <FreqDial score={92} label="Match" />
            <FreqDial score={47} size={140} label="Sync" />
          </View>
        </View>

        <Waveform />

        <View className="gap-3">
          <Mono>Buttons</Mono>
          <View className="flex-row flex-wrap gap-3">
            <Button>
              <Text>Default</Text>
            </Button>
            <Button variant="secondary">
              <Text>Secondary</Text>
            </Button>
            <Button variant="outline">
              <Text>Outline</Text>
            </Button>
            <Button variant="ghost">
              <Text>Ghost</Text>
            </Button>
            <Button variant="destructive">
              <Text>Destructive</Text>
            </Button>
            <Button variant="link">
              <Text>Link</Text>
            </Button>
          </View>
          <View className="flex-row flex-wrap items-center gap-3">
            <Button size="sm">
              <Text>Small</Text>
            </Button>
            <Button size="default">
              <Text>Default size</Text>
            </Button>
            <Button size="lg">
              <Text>Large</Text>
            </Button>
          </View>
        </View>

        <Waveform />

        <View className="gap-3">
          <Mono>Card</Mono>
          <Card>
            <CardHeader>
              <CardTitle>The Midnight Romantic</CardTitle>
              <CardDescription>3 rare shared artists · both late-night listeners</CardDescription>
            </CardHeader>
            <CardContent>
              <Body>
                A 2am playlist and a soft spot for the same overlooked B-side — that&apos;s not
                nothing.
              </Body>
            </CardContent>
            <CardFooter className="gap-3">
              <Button size="sm">
                <Text>Say something</Text>
              </Button>
              <Button size="sm" variant="outline">
                <Text>Skip</Text>
              </Button>
            </CardFooter>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
