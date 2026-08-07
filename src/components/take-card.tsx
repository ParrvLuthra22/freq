import * as React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import {
  fetchGameSession,
  subscribeToGameSession,
  submitTakeValue,
  type TakeState,
} from '@/lib/games';

/** Hot Take — both sides lock in a 0–100 slider, then see how far apart they landed. */
type TakeCardProps = {
  sessionId: string;
  mockName: string;
};

function gapLine(gap: number): string {
  if (gap <= 5) return 'Eerily close.';
  if (gap <= 20) return 'Not far off at all.';
  if (gap <= 45) return 'A real gap, but an honest one.';
  return 'Wildly different instincts — somehow that is kind of interesting.';
}

function TakeCard({ sessionId, mockName }: TakeCardProps) {
  const [state, setState] = React.useState<TakeState | null>(null);
  const [draft, setDraft] = React.useState(50);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetchGameSession(sessionId).then((session) => {
      if (!cancelled && session?.game === 'take') setState(session.state);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  React.useEffect(
    () =>
      subscribeToGameSession(sessionId, (next) => setState(next as TakeState)),
    [sessionId],
  );

  const lockIn = async () => {
    if (submitting || !state || state.userValue !== null) return;
    setSubmitting(true);
    const next = await submitTakeValue(sessionId, draft);
    setSubmitting(false);
    if (next) setState(next);
  };

  if (!state) {
    return (
      <View className="max-w-[90%] gap-2 self-center rounded-2xl border border-border bg-card px-4 py-3">
        <Mono className="text-accent">Hot take</Mono>
        <Body className="text-sm text-muted-foreground">Loading…</Body>
      </View>
    );
  }

  const bothIn = state.userValue !== null && state.mockValue !== null;

  return (
    <View className="max-w-[90%] gap-3 self-center rounded-2xl border border-accent bg-accent/10 px-4 py-3.5">
      <Mono className="text-accent">Hot take</Mono>
      <Body>{state.prompt}</Body>

      {bothIn ? (
        <View className="gap-1.5">
          <View className="flex-row items-baseline justify-between">
            <Display className="text-2xl text-accent">
              {state.userValue}
            </Display>
            <Mono>vs</Mono>
            <Display className="text-2xl text-accent">
              {state.mockValue}
            </Display>
          </View>
          <Body>
            {gapLine(Math.abs((state.userValue ?? 0) - (state.mockValue ?? 0)))}
          </Body>
        </View>
      ) : state.userValue !== null ? (
        <View className="gap-1.5">
          <Display className="text-2xl text-accent">{state.userValue}</Display>
          <Mono>Locked in — waiting on {mockName}…</Mono>
        </View>
      ) : (
        <View className="gap-1">
          <Slider value={draft} onChange={setDraft} disabled={submitting} />
          <View className="flex-row items-center justify-between">
            <Mono>0</Mono>
            <Display className="text-xl">{draft}</Display>
            <Mono>100</Mono>
          </View>
          <Button
            size="sm"
            onPress={lockIn}
            disabled={submitting}
            className="mt-1 self-start"
          >
            <Text>Lock it in</Text>
          </Button>
        </View>
      )}
    </View>
  );
}

export { TakeCard };
