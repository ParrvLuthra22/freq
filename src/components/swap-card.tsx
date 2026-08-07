import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Body, Mono } from '@/components/ui/typography';
import {
  fetchGameSession,
  subscribeToGameSession,
  submitSwapTrack,
  type SwapState,
} from '@/lib/games';
import { getMe, type DiscoverUser } from '@/lib/seed';

/**
 * Blind Swap — each side sends one track from their own pool (the human's
 * `swapPicks`, the mock's authored `swap.track`). Neither track renders until
 * both fields are set; the mock's is filled in by mock-reply, same async
 * "their move can land whenever" shape as the other games.
 */
type SwapCardProps = {
  sessionId: string;
  mock: DiscoverUser;
};

function SwapCard({ sessionId, mock }: SwapCardProps) {
  const [state, setState] = React.useState<SwapState | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetchGameSession(sessionId).then((session) => {
      if (!cancelled && session?.game === 'swap') setState(session.state);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  React.useEffect(
    () =>
      subscribeToGameSession(sessionId, (next) => setState(next as SwapState)),
    [sessionId],
  );

  const send = async (track: string) => {
    if (submitting || !state || state.userTrack !== null) return;
    setSubmitting(true);
    const next = await submitSwapTrack(sessionId, track);
    setSubmitting(false);
    if (next) setState(next);
  };

  if (!state) {
    return (
      <View className="max-w-[90%] gap-2 self-center rounded-2xl border border-border bg-card px-4 py-3">
        <Mono className="text-accent">Blind swap</Mono>
        <Body className="text-sm text-muted-foreground">Loading…</Body>
      </View>
    );
  }

  const bothIn = state.userTrack !== null && state.mockTrack !== null;
  const swapPicks = getMe().swapPicks;

  return (
    <View className="max-w-[90%] gap-3 self-center rounded-2xl border border-accent bg-accent/10 px-4 py-3.5">
      <Mono className="text-accent">Blind swap</Mono>

      {bothIn ? (
        <View className="gap-1.5">
          <Body>You sent {state.userTrack}.</Body>
          <Body>
            {mock.name} sent {state.mockTrack}.
          </Body>
          <Body className="text-muted-foreground">{mock.swap.verdict}</Body>
        </View>
      ) : state.userTrack !== null ? (
        <View className="gap-1.5">
          <Body>You sent {state.userTrack}.</Body>
          <Mono>Sealed until {mock.name} sends theirs…</Mono>
        </View>
      ) : (
        <>
          <Body>Send one track — sealed until they send theirs too.</Body>
          <View className="gap-2">
            {swapPicks.map((track) => (
              <Pressable
                key={track}
                onPress={() => send(track)}
                disabled={submitting}
                className="rounded-xl border border-border px-3.5 py-2.5 active:opacity-70"
              >
                <Body className="text-sm">{track}</Body>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

export { SwapCard };
