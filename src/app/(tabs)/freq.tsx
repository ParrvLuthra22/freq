import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EnergyBars } from '@/components/ui/energy-bars';
import { RhythmChart } from '@/components/ui/rhythm-chart';
import { FreqDial } from '@/components/ui/freq-dial';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import { Waveform } from '@/components/ui/waveform';
import { getMe } from '@/lib/seed';

function splitArchetype(name: string) {
  const words = name.trim().split(' ');
  const accent = words.pop() ?? '';
  return { lead: words.join(' '), accent };
}

export default function FreqScreen() {
  const me = getMe();
  const { lead, accent } = splitArchetype(me.archetype.name);
  const energyValues = Object.values(me.energy);
  const signature = Math.round(energyValues.reduce((a, b) => a + b, 0) / energyValues.length);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-8 px-6 pb-16 pt-4">
        <View className="flex-row items-center gap-3">
          <Avatar seed={me.id} name={me.name} size={48} />
          <View>
            <Body>
              {me.name}, {me.age}
            </Body>
            <Mono>{me.campus}</Mono>
          </View>
        </View>

        <View className="items-center gap-3 py-2">
          <FreqDial score={signature} label="Signature" size={180} />
          <View className="items-center">
            <Display className="text-center text-3xl leading-tight">{lead}</Display>
            <Display italic className="text-center text-3xl leading-tight text-accent">
              {accent}
            </Display>
          </View>
          <Body className="px-6 text-center text-muted-foreground">{me.archetype.description}</Body>
        </View>

        <View className="gap-2">
          <Mono>Current frequency</Mono>
          <View className="rounded-2xl border border-border bg-card px-4 py-3">
            <Body className="text-sm">{me.currentFrequency}</Body>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/weekly')}
          className="flex-row items-center justify-between rounded-2xl border border-accent bg-accent/10 px-4 py-4 active:opacity-70">
          <View className="flex-1 gap-0.5 pr-3">
            <Mono className="text-accent">The weekly drop</Mono>
            <Body className="text-sm">Your week in sound — ready.</Body>
          </View>
          <Mono className="text-accent">Open →</Mono>
        </Pressable>

        <Waveform />

        <View className="gap-4">
          <Mono>Energy</Mono>
          <EnergyBars energy={me.energy} />
        </View>

        <Waveform />

        <View className="gap-3">
          <Mono>Your clock</Mono>
          <RhythmChart mine={me.listeningHours} height={100} />
        </View>

        <Waveform />

        <View className="gap-1">
          <Mono>Top artists</Mono>
          {me.topArtists.map((artist, index) => (
            <View
              key={artist.name}
              className="flex-row items-center justify-between border-b border-border py-3">
              <View className="flex-row items-center gap-3">
                <Mono className="w-6">{index + 1}</Mono>
                <Body>{artist.name}</Body>
              </View>
              {artist.rank < 35 ? <Mono className="text-accent">Rare</Mono> : null}
            </View>
          ))}
        </View>

        <Button size="lg" onPress={() => router.push({ pathname: '/share', params: { variant: 'solo' } })}>
          <Text>Share my FREQ</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
