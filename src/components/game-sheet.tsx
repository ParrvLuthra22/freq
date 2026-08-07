import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Body, Mono } from '@/components/ui/typography';
import { fetchGameSessions, startGame, type GameKind } from '@/lib/games';
import type { DiscoverUser } from '@/lib/seed';
import type { StoredMessage } from '@/lib/chat';
import { cn } from '@/lib/utils';

export type GameSheetHandle = { present: () => void };

type GameSheetProps = {
  /** Null in local mode — games need a real match to sync through, so the sheet has nothing to offer. */
  matchId: string | null;
  mock: DiscoverUser;
  onStarted: (message: StoredMessage) => void;
};

const GAMES: { kind: GameKind; title: string; blurb: string }[] = [
  {
    kind: 'quiz',
    title: 'Guess their #1',
    blurb: 'Four options. One is really their most-played artist.',
  },
  {
    kind: 'take',
    title: 'Hot take',
    blurb: 'Both drop a number, then see how far apart you landed.',
  },
];

/**
 * The ◇ button's picker — one game per match, ever (`game_sessions` has
 * `unique(match_id, game)`), so a game already started here shows as played
 * rather than offering to start a second round. `present()` refetches which
 * games exist every time it opens, since that can change between visits.
 */
const GameSheet = React.forwardRef<GameSheetHandle, GameSheetProps>(
  function GameSheet({ matchId, mock, onStarted }, ref) {
    const sheetRef = React.useRef<BottomSheetModal>(null);
    const [played, setPlayed] = React.useState<Set<GameKind>>(new Set());
    const [starting, setStarting] = React.useState<GameKind | null>(null);

    React.useImperativeHandle(ref, () => ({
      present: () => {
        if (matchId) {
          fetchGameSessions(matchId).then((sessions) => {
            setPlayed(new Set(sessions.map((s) => s.game)));
          });
        }
        sheetRef.current?.present();
      },
    }));

    const pick = async (kind: GameKind) => {
      if (!matchId || played.has(kind) || starting) return;
      setStarting(kind);
      const result = await startGame(matchId, kind, mock);
      setStarting(null);
      sheetRef.current?.dismiss();
      if (result) onStarted(result.message);
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['42%']}
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
        <BottomSheetView className="gap-3 px-5 pb-8 pt-2">
          <Mono className="px-1">Play something</Mono>
          {GAMES.map(({ kind, title, blurb }) => {
            const isPlayed = played.has(kind);
            return (
              <Pressable
                key={kind}
                onPress={() => pick(kind)}
                disabled={isPlayed || starting !== null}
                className={cn(
                  'gap-1 rounded-2xl border px-4 py-3.5 active:opacity-70',
                  isPlayed ? 'border-border opacity-50' : 'border-accent',
                )}
              >
                <View className="flex-row items-center justify-between">
                  <Body>{title}</Body>
                  <Mono className={isPlayed ? undefined : 'text-accent'}>
                    {isPlayed
                      ? 'Played'
                      : starting === kind
                        ? 'Starting…'
                        : 'Play'}
                  </Mono>
                </View>
                <Body className="text-sm text-muted-foreground">{blurb}</Body>
              </Pressable>
            );
          })}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

export { GameSheet };
