import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as React from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Body, Mono } from '@/components/ui/typography';
import { connectLastfm } from '@/lib/lastfm';
import { getMe } from '@/lib/seed';

export type LastfmSheetHandle = { present: () => void };

/**
 * The You tab's Last.fm connector — same job as onboarding's inline form,
 * just reachable any time afterward, and aware of an existing connection so
 * re-syncing (or connecting a different account) doesn't look like starting
 * from zero.
 */
const LastfmSheet = React.forwardRef<LastfmSheetHandle>(
  function LastfmSheet(_props, ref) {
    const sheetRef = React.useRef<BottomSheetModal>(null);
    const [username, setUsername] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const connected = getMe().lastfmUsername;

    React.useImperativeHandle(ref, () => ({
      present: () => {
        setUsername(connected ?? '');
        setError(null);
        sheetRef.current?.present();
      },
    }));

    const connect = async () => {
      if (busy) return;
      setError(null);
      setBusy(true);
      const result = await connectLastfm(username);
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      sheetRef.current?.dismiss();
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['45%']}
        backgroundStyle={{ backgroundColor: '#1B1815' }}
        handleIndicatorStyle={{ backgroundColor: '#8B857A' }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
          />
        )}
      >
        <BottomSheetView className="gap-4 px-5 pb-8 pt-2">
          <Mono className="px-1">Last.fm</Mono>

          {connected ? (
            <Body className="text-sm text-muted-foreground">
              Connected as {connected}. Re-sync to rebuild your profile from
              your latest scrobbles, or enter a different username to switch
              accounts.
            </Body>
          ) : (
            <Body className="text-sm text-muted-foreground">
              Rebuilds your profile — top artists, tracks, tags, energy, and
              listening rhythm — from your real Last.fm history.
            </Body>
          )}

          <View className="gap-2">
            <Mono>Username</Mono>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. rj"
              placeholderClassName="text-muted-foreground"
              autoCapitalize="none"
              autoCorrect={false}
              className="rounded-2xl border border-border bg-card px-4 py-3 font-body text-foreground"
            />
          </View>

          {error ? (
            <Body className="text-sm text-destructive">{error}</Body>
          ) : null}

          <Button
            size="lg"
            onPress={connect}
            disabled={busy || username.trim().length === 0}
          >
            <Text>
              {busy
                ? 'Rebuilding your profile…'
                : connected
                  ? 'Re-sync'
                  : 'Connect'}
            </Text>
          </Button>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

export { LastfmSheet };
