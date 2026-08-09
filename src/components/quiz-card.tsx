import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Body, Mono } from '@/components/ui/typography';
import {
  fetchGameSession,
  subscribeToGameSession,
  submitQuizGuess,
  type QuizState,
} from '@/lib/games';
import { cn } from '@/lib/utils';

/**
 * Guess Their #1 — two independent one-question rounds sharing one card: the
 * human guesses the mock's authored #1 (`mockOptions`/`mockAnswer`, seeded
 * content), the mock guesses the human's real #1 back (`userOptions`, picked
 * once at game start — see `games.ts`). Both rounds resolve independently;
 * the reveal only shows once both guesses exist.
 */
type QuizCardProps = {
  sessionId: string;
  mockName: string;
};

function QuizCard({ sessionId, mockName }: QuizCardProps) {
  const [state, setState] = React.useState<QuizState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetchGameSession(sessionId).then((session) => {
      if (cancelled) return;
      if (session?.game === 'quiz') setState(session.state);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  React.useEffect(
    () =>
      subscribeToGameSession(sessionId, (next) => setState(next as QuizState)),
    [sessionId],
  );

  const guess = async (option: string) => {
    if (submitting || !state || state.userGuess !== null) return;
    setSubmitting(true);
    const next = await submitQuizGuess(sessionId, option);
    setSubmitting(false);
    if (next) setState(next);
  };

  if (loading) {
    return (
      <View className="max-w-[90%] gap-3 self-center rounded-2xl border border-border bg-card px-4 py-3.5">
        <Mono className="text-accent">Guess their #1</Mono>
        <Skeleton className="h-4 w-4/5 rounded" />
        <View className="gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </View>
      </View>
    );
  }

  if (!state) {
    return (
      <View className="max-w-[90%] gap-2 self-center rounded-2xl border border-border bg-card px-4 py-3">
        <Mono className="text-accent">Guess their #1</Mono>
        <Body className="text-sm text-muted-foreground">
          Couldn&apos;t load this one — try reopening the thread.
        </Body>
      </View>
    );
  }

  const bothIn = state.userGuess !== null && state.mockGuess !== null;

  return (
    <View className="max-w-[90%] gap-3 self-center rounded-2xl border border-accent bg-accent/10 px-4 py-3.5">
      <Mono className="text-accent">Guess their #1</Mono>

      {bothIn ? (
        <View className="gap-1.5">
          <Body>
            {state.userGuess === state.mockAnswer
              ? 'You got it.'
              : 'Not quite.'}{' '}
            {mockName}&apos;s #1 is really {state.mockAnswer}.
          </Body>
          <Body>
            {state.mockGuess === state.userAnswer
              ? `${mockName} got yours too — ${state.userAnswer}.`
              : `${mockName} guessed ${state.mockGuess} for you — it's actually ${state.userAnswer}.`}
          </Body>
        </View>
      ) : (
        <>
          <Body>Which artist is really {mockName}&apos;s #1?</Body>
          <View className="gap-2">
            {state.mockOptions.map((option) => {
              const picked = state.userGuess === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => guess(option)}
                  disabled={state.userGuess !== null || submitting}
                  className={cn(
                    'rounded-xl border px-3.5 py-2.5 active:opacity-70',
                    picked ? 'border-accent bg-accent/20' : 'border-border',
                  )}
                >
                  <Body className="text-sm">{option}</Body>
                </Pressable>
              );
            })}
          </View>
          {state.userGuess !== null ? (
            <Mono>{mockName} is still thinking…</Mono>
          ) : null}
        </>
      )}
    </View>
  );
}

export { QuizCard };
