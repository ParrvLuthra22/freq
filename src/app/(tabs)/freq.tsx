import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CardArtistSheet,
  type CardArtistSheetHandle,
} from '@/components/card-artist-sheet';
import {
  EditProfileSheet,
  type EditProfileSheetHandle,
} from '@/components/edit-profile-sheet';
import { LastfmSheet, type LastfmSheetHandle } from '@/components/lastfm-sheet';
import { Avatar } from '@/components/ui/avatar';
import { EnergyBars } from '@/components/ui/energy-bars';
import { RhythmChart } from '@/components/ui/rhythm-chart';
import { FreqDial } from '@/components/ui/freq-dial';
import { Body, Display, Mono } from '@/components/ui/typography';
import { Waveform } from '@/components/ui/waveform';
import { useAuth } from '@/lib/auth';
import { getMe } from '@/lib/seed';
import { resetStore, usePersistedState } from '@/lib/store';

/** Same obscurity threshold the deck's "Rare" chip and the score breakdown use. */
const RARE_RANK = 35;

function splitArchetype(name: string) {
  const words = name.trim().split(' ');
  const accent = words.pop() ?? '';
  return { lead: words.join(' '), accent };
}

export default function FreqScreen() {
  const me = getMe();
  const { cardArtist } = usePersistedState();
  const { mode, leave } = useAuth();
  const { lead, accent } = splitArchetype(me.archetype.name);
  const energyValues = Object.values(me.energy);
  const signature = Math.round(
    energyValues.reduce((a, b) => a + b, 0) / energyValues.length,
  );
  const editSheetRef = React.useRef<EditProfileSheetHandle>(null);
  const artistSheetRef = React.useRef<CardArtistSheetHandle>(null);
  const lastfmSheetRef = React.useRef<LastfmSheetHandle>(null);

  // Wipes the local cache too — otherwise the next sign-in on this device
  // would flash the previous session's swipes and profile before Supabase's
  // reconciled version overwrites them.
  const handleLogOut = React.useCallback(async () => {
    await leave();
    resetStore();
    router.replace('/');
  }, [leave]);

  const currentCardArtist =
    cardArtist ?? me.topArtists[0]?.name ?? me.week.artist;
  const rareArtists = me.topArtists.filter((artist) => artist.rank < RARE_RANK);
  const rarest = me.topArtists.reduce(
    (min, artist) => (artist.rank < min.rank ? artist : min),
    me.topArtists[0],
  );

  return (
    <BottomSheetModalProvider>
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView
          contentContainerClassName="gap-8 px-6 pb-16 pt-4"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center gap-3">
            <View style={{ width: 48, height: 48 }}>
              <Avatar seed={me.id} name={me.name} size={48} />
            </View>
            <View className="flex-1">
              <Body>
                {me.name}, {me.age}
              </Body>
              <Mono>{me.campus}</Mono>
            </View>
            <Pressable
              onPress={() => editSheetRef.current?.present()}
              hitSlop={8}
              className="rounded-full border border-border px-3.5 py-2 active:opacity-70"
            >
              <Mono>Edit</Mono>
            </Pressable>
          </View>

          {/* Reiterates the app's whole mechanic from your own side: your sleeve
              shows the same way to everyone else's deck as theirs shows to you. */}
          <View className="flex-row items-center gap-2 self-start rounded-full border border-border bg-card px-3.5 py-2">
            <Body>🔒</Body>
            <Mono>Your photo stays sealed until it&apos;s mutual</Mono>
          </View>

          <View className="items-center gap-3 py-2">
            <FreqDial score={signature} label="Signature" size={180} />
            <View className="items-center">
              <Display className="text-center text-3xl leading-tight">
                {lead}
              </Display>
              <Display
                italic
                className="text-center text-3xl leading-tight text-accent"
              >
                {accent}
              </Display>
            </View>
            <Body className="px-6 text-center text-muted-foreground">
              {me.archetype.description}
            </Body>
          </View>

          <Pressable
            onPress={() => artistSheetRef.current?.present()}
            className="flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 active:opacity-70"
          >
            <View className="flex-1 gap-0.5 pr-3">
              <Mono>The artist people meet you through</Mono>
              <Body>{currentCardArtist}</Body>
            </View>
            <Mono className="text-accent">Change →</Mono>
          </Pressable>

          <Pressable
            onPress={() => lastfmSheetRef.current?.present()}
            className="flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 active:opacity-70"
          >
            <View className="flex-1 gap-0.5 pr-3">
              <Mono>Last.fm</Mono>
              <Body>
                {me.lastfmUsername
                  ? `Connected as ${me.lastfmUsername}`
                  : 'Not connected'}
              </Body>
            </View>
            <Mono className="text-accent">
              {me.lastfmUsername ? 'Re-sync →' : 'Connect →'}
            </Mono>
          </Pressable>

          <View className="gap-2">
            <Mono>Current frequency</Mono>
            <View className="rounded-2xl border border-border bg-card px-4 py-3">
              <Body className="text-sm">{me.currentFrequency}</Body>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/week')}
            className="flex-row items-center justify-between rounded-2xl border border-accent bg-accent/10 px-4 py-4 active:opacity-70"
          >
            <View className="flex-1 gap-0.5 pr-3">
              <Mono className="text-accent">Your week</Mono>
              <Body className="text-sm">
                {me.week.artist} — your artist of the week.
              </Body>
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

          <View className="gap-2">
            <Mono>Rarity</Mono>
            <View className="rounded-2xl border border-border bg-card px-4 py-3">
              <Body className="text-sm">
                {rareArtists.length} of your top {me.topArtists.length} artists
                are genuinely rare here — {rarest.name} rarer than anyone
                typically has.
              </Body>
            </View>
          </View>

          <View className="gap-1">
            <Mono>Top artists</Mono>
            {me.topArtists.map((artist, index) => (
              <View
                key={artist.name}
                className="flex-row items-center justify-between border-b border-border py-3"
              >
                <View className="flex-row items-center gap-3">
                  <Mono className="w-6">{index + 1}</Mono>
                  <Body>{artist.name}</Body>
                </View>
                {artist.rank < RARE_RANK ? (
                  <Mono className="text-accent">Rare</Mono>
                ) : null}
              </View>
            ))}
          </View>

          {mode === 'signed-in' ? (
            <Pressable
              onPress={handleLogOut}
              className="items-center rounded-2xl border border-border py-4 active:opacity-70"
            >
              <Mono className="text-muted-foreground">Log out</Mono>
            </Pressable>
          ) : null}
        </ScrollView>

        <EditProfileSheet ref={editSheetRef} />
        <CardArtistSheet ref={artistSheetRef} />
        <LastfmSheet ref={lastfmSheetRef} />
      </SafeAreaView>
    </BottomSheetModalProvider>
  );
}
