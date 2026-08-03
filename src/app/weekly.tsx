import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumArt } from '@/components/ui/album-art';
import { Button } from '@/components/ui/button';
import { RhythmChart } from '@/components/ui/rhythm-chart';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import { Waveform } from '@/components/ui/waveform';
import { getMe } from '@/lib/seed';
import { useLikedIds } from '@/lib/store';
import { buildWeeklyDrop, formatHour } from '@/lib/weekly';

/** The week in sound — a Wrapped-style moment built only from real numbers. */
export default function WeeklyDropScreen() {
  const me = getMe();
  const likedIds = useLikedIds();
  const drop = React.useMemo(() => buildWeeklyDrop(me, likedIds), [me, likedIds]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-7 px-6 pb-16" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} className="self-start py-3">
          <Mono className="text-accent">← Back</Mono>
        </Pressable>

        <View className="gap-1">
          <Mono>The weekly drop</Mono>
          <Display className="text-4xl leading-tight">{drop.headline}</Display>
          <Display italic className="text-4xl leading-tight text-accent">
            {drop.accent}
          </Display>
        </View>

        {drop.topArtist ? (
          <View className="items-center gap-4 py-2">
            <AlbumArt seed={drop.topArtist.name} size={200} shape="square" />
            <View className="items-center gap-1">
              <Mono>Most played</Mono>
              <Display className="text-center text-3xl leading-tight">
                {drop.topArtist.name}
              </Display>
              {drop.topTrack ? (
                <Body className="text-center text-muted-foreground">
                  {drop.topTrack.title}
                </Body>
              ) : null}
            </View>
          </View>
        ) : null}

        <Waveform />

        <View className="gap-5">
          {drop.stats.map((stat) => (
            <View key={stat.label} className="gap-1 border-t border-border pt-4">
              <Mono>{stat.label}</Mono>
              <Display className="text-2xl leading-tight">{stat.value}</Display>
              {stat.note ? (
                <Body className="text-sm text-muted-foreground">{stat.note}</Body>
              ) : null}
            </View>
          ))}
        </View>

        <View className="gap-3 border-t border-border pt-5">
          <Mono>When you listened</Mono>
          <RhythmChart mine={drop.listeningHours} height={110} />
          <Body className="text-sm text-muted-foreground">
            You peak at {formatHour(drop.peakHour)} — which explains a lot.
          </Body>
        </View>

        <Button size="lg" onPress={() => router.push('/share')}>
          <Text>Share this drop</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
