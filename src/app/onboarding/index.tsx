import { router } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import { Waveform } from '@/components/ui/waveform';
import { appleAvailable, useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * The way in.
 *
 * The demo is the loud button, not the fallback. FREQ is a portfolio piece as
 * much as a product, and asking someone to hand over a Google account before
 * they have seen a single card is the wrong trade.
 *
 * With no project configured this is just the old welcome screen — the app runs
 * locally off the seed and none of the providers are reachable.
 */
export default function OnboardingWelcomeScreen() {
  const { mode, busy, error, google, demo } = useAuth();
  const local = mode === 'local' || !isSupabaseConfigured;

  // Signing in lands you on the first question rather than back here.
  React.useEffect(() => {
    if (mode === 'signed-in') router.replace('/onboarding/name');
  }, [mode]);

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
          One question per screen. Name, age, campus, what you&apos;re looking for — then we read
          what you actually listen to.
        </Body>
        <Waveform />

        {local ? (
          <Button size="lg" onPress={() => router.push('/onboarding/name')}>
            <Text>Get started</Text>
          </Button>
        ) : (
          <View className="gap-3">
            {/* Loudest affordance on the screen, on purpose. */}
            <Button size="lg" onPress={demo} disabled={busy}>
              <Text>{busy ? 'One moment…' : 'Try the demo'}</Text>
            </Button>
            <Body className="text-center text-xs text-muted-foreground">
              No account, no email. Look around first.
            </Body>

            <View className="flex-row items-center gap-3 pt-1">
              <View className="h-px flex-1 bg-border" />
              <Mono>or</Mono>
              <View className="h-px flex-1 bg-border" />
            </View>

            <Pressable
              onPress={google}
              disabled={busy}
              className="h-12 flex-row items-center justify-center rounded-xl border border-border active:opacity-70">
              <Body>Continue with Google</Body>
            </Pressable>

            {appleAvailable ? (
              <Pressable
                disabled
                className="h-12 flex-row items-center justify-center rounded-xl border border-border opacity-40">
                <Body>Continue with Apple</Body>
              </Pressable>
            ) : null}

            <Pressable
              disabled
              className="h-12 flex-row items-center justify-center rounded-xl border border-border opacity-40">
              <Body>Email me a link</Body>
            </Pressable>

            {busy ? <ActivityIndicator className="pt-1" /> : null}

            {error ? (
              <Body className="text-center text-xs text-accent">{error}</Body>
            ) : (
              <Mono className="pt-1 text-center">Apple and email are coming</Mono>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
