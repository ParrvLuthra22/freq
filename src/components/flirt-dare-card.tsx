import * as React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Body, Mono } from '@/components/ui/typography';
import {
  fetchGameSession,
  subscribeToGameSession,
  type FlirtDareState,
} from '@/lib/games';

/**
 * Flirt or Dare — asymmetric, unlike the other three games: the human always
 * drew and sent this (drafting happened in the picker sheet, before the
 * session even existed), so there is nothing left for them to do here but
 * wait. Only the mock, via mock-reply, ever fills `response`.
 */
type FlirtDareCardProps = {
  sessionId: string;
  mockName: string;
};

function FlirtDareCard({ sessionId, mockName }: FlirtDareCardProps) {
  const [state, setState] = React.useState<FlirtDareState | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    fetchGameSession(sessionId).then((session) => {
      if (cancelled) return;
      if (session?.game === 'flirt') setState(session.state);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  React.useEffect(
    () =>
      subscribeToGameSession(sessionId, (next) =>
        setState(next as FlirtDareState),
      ),
    [sessionId],
  );

  if (loading) {
    return (
      <View className="max-w-[90%] gap-3 self-center rounded-2xl border border-border bg-card px-4 py-3.5">
        <Mono className="text-accent">Flirt or dare</Mono>
        <Skeleton className="h-4 w-4/5 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
      </View>
    );
  }

  if (!state) {
    return (
      <View className="max-w-[90%] gap-2 self-center rounded-2xl border border-border bg-card px-4 py-3">
        <Mono className="text-accent">Flirt or dare</Mono>
        <Body className="text-sm text-muted-foreground">
          Couldn&apos;t load this one — try reopening the thread.
        </Body>
      </View>
    );
  }

  return (
    <View className="max-w-[90%] gap-3 self-center rounded-2xl border border-accent bg-accent/10 px-4 py-3.5">
      <Mono className="text-accent">
        {state.kind === 'flirt' ? 'Flirt' : 'Dare'}
      </Mono>
      <Body>{state.prompt}</Body>

      {state.response !== null ? (
        <View className="gap-0.5 border-t border-border pt-2.5">
          <Mono>{mockName}</Mono>
          <Body>{state.response}</Body>
        </View>
      ) : (
        <Mono>Waiting on {mockName}…</Mono>
      )}
    </View>
  );
}

export { FlirtDareCard };
