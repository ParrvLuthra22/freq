import { router } from 'expo-router';
import * as React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectCard } from '@/components/connect-card';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import { connectLastfm } from '@/lib/lastfm';

/** Only Last.fm can actually connect today — see the Spotify card below. */
type Service = 'lastfm';

export default function ConnectMusicScreen() {
  const [connecting, setConnecting] = React.useState<Service | null>(null);
  const [showLastfmForm, setShowLastfmForm] = React.useState(false);
  const [username, setUsername] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const handleConnectLastfm = async () => {
    if (connecting) return;
    setError(null);
    setConnecting('lastfm');

    const result = await connectLastfm(username);
    if (!result.ok) {
      setError(result.error);
      setConnecting(null);
      return;
    }

    router.replace('/onboarding/building');
  };

  /**
   * The way through for someone with no Last.fm account.
   *
   * Spotify used to be this escape hatch by accident — it "connected" without
   * any OAuth and let anyone continue. Labelling it honestly closed the only
   * exit from this screen, which would strand most visitors to a public demo
   * on the last step of onboarding. This is the same escape hatch, named for
   * what it actually is: you continue on the sample profile, and the Connect
   * card on the You tab is still there whenever you want real data.
   */
  const handleSkip = () => {
    if (connecting) return;
    router.replace('/onboarding/building');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* The Last.fm field sits low on this screen, so without this the
          keyboard covers both it and the Connect button. Same reasoning as
          OnboardingStep, which handles the numbered steps. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            gap: 24,
            paddingHorizontal: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Mono>Connect music</Mono>
          <View>
            <Display className="text-4xl leading-tight">Show us what</Display>
            <Display italic className="text-4xl leading-tight text-accent">
              you actually play.
            </Display>
          </View>
          <Body className="text-muted-foreground">
            Last.fm reads every scrobble you already have. Spotify is next — we
            only need one either way.
          </Body>

          <View className="gap-4 pt-2">
            {/* Labelled, not faked. This card used to call `getMe()` and
              continue, presenting the seeded mock profile as though it had
              come from the user's own account — the one place in the app that
              actively told them something untrue. Real support needs a
              Spotify app, a PKCE flow, and server-side token exchange and
              refresh, none of which exist yet. */}
            <ConnectCard
              title="Spotify"
              reassurance="Top artists, top tracks, recent plays — not the playlist names you're pretending are ironic."
              connecting={false}
              comingSoon
              onPress={() => {}}
            />
            <ConnectCard
              title="Last.fm"
              reassurance="Every scrobble, unfiltered — the real-time record of what you actually pressed play on."
              connecting={connecting === 'lastfm'}
              disabled={connecting !== null && connecting !== 'lastfm'}
              onPress={() => setShowLastfmForm((v) => !v)}
            />

            {showLastfmForm ? (
              <View className="gap-3 rounded-2xl border border-border bg-card p-4">
                <Mono>Your Last.fm username</Mono>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="e.g. rj"
                  placeholderClassName="text-muted-foreground"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="rounded-xl border border-border bg-background px-4 py-3 font-body text-foreground"
                />
                {error ? (
                  <Body className="text-sm text-destructive">{error}</Body>
                ) : null}
                <Button
                  onPress={handleConnectLastfm}
                  disabled={connecting !== null || username.trim().length === 0}
                >
                  <Text>
                    {connecting === 'lastfm'
                      ? 'Rebuilding your profile…'
                      : 'Connect'}
                  </Text>
                </Button>
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={handleSkip}
            disabled={connecting !== null}
            className="items-center pt-2 active:opacity-60"
          >
            <Mono>Skip for now →</Mono>
            <Body className="pt-1 text-center text-sm text-muted-foreground">
              Look around on a sample profile. You can connect later.
            </Body>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
