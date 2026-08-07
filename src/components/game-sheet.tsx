import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Body, Mono } from '@/components/ui/typography';
import {
  drawPrompt,
  fetchGameSessions,
  startFlirtDare,
  startGame,
  type AutoGameKind,
  type GameKind,
} from '@/lib/games';
import type { StoredMessage } from '@/lib/chat';
import type { DiscoverUser } from '@/lib/seed';
import { cn } from '@/lib/utils';

export type GameSheetHandle = { present: () => void };

type GameSheetProps = {
  /** Null in local mode — games need a real match to sync through, so the sheet has nothing to offer. */
  matchId: string | null;
  mock: DiscoverUser;
  onStarted: (message: StoredMessage) => void;
};

const AUTO_GAMES: { kind: AutoGameKind; title: string; blurb: string }[] = [
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
  {
    kind: 'swap',
    title: 'Blind swap',
    blurb: 'Both send a track. Neither shows until both have.',
  },
];

const FLIRT_GAME = {
  kind: 'flirt' as const,
  title: 'Flirt or dare',
  blurb: 'Draw a prompt, send it, see how they respond.',
};

const ALL_GAMES = [...AUTO_GAMES, FLIRT_GAME];

/**
 * The ◇ button's picker — one game per match, ever (`game_sessions` has
 * `unique(match_id, game)`), so a game already started here shows as played
 * rather than offering to start a second round. `present()` refetches which
 * games exist every time it opens, since that can change between visits.
 *
 * Three of the four games start the instant you tap them — there is nothing
 * to configure first. Flirt or Dare is the exception: drawing and redrawing
 * happens right here, entirely client-side, before anything is written —
 * only the card you actually choose to send ever reaches the database.
 */
const GameSheet = React.forwardRef<GameSheetHandle, GameSheetProps>(
  function GameSheet({ matchId, mock, onStarted }, ref) {
    const sheetRef = React.useRef<BottomSheetModal>(null);
    const [played, setPlayed] = React.useState<Set<GameKind>>(new Set());
    const [starting, setStarting] = React.useState<GameKind | null>(null);
    const [draft, setDraft] = React.useState<{
      kind: 'flirt' | 'dare';
      prompt: string;
    } | null>(null);

    React.useImperativeHandle(ref, () => ({
      present: () => {
        setDraft(null);
        if (matchId) {
          fetchGameSessions(matchId).then((sessions) => {
            setPlayed(new Set(sessions.map((s) => s.game)));
          });
        }
        sheetRef.current?.present();
      },
    }));

    const playAuto = async (kind: AutoGameKind) => {
      if (!matchId || played.has(kind) || starting) return;
      setStarting(kind);
      const result = await startGame(matchId, kind, mock);
      setStarting(null);
      sheetRef.current?.dismiss();
      if (result) onStarted(result.message);
    };

    const sendDraft = async () => {
      if (!matchId || !draft || starting) return;
      setStarting('flirt');
      const result = await startFlirtDare(matchId, draft);
      setStarting(null);
      setDraft(null);
      sheetRef.current?.dismiss();
      if (result) onStarted(result.message);
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['55%']}
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
          {draft ? (
            <View className="gap-3">
              <View className="flex-row items-center justify-between px-1">
                <Mono>{draft.kind === 'flirt' ? 'Flirt' : 'Dare'}</Mono>
                <Pressable onPress={() => setDraft(null)} hitSlop={8}>
                  <Mono>Back</Mono>
                </Pressable>
              </View>
              <View className="rounded-2xl border border-accent bg-accent/10 px-4 py-4">
                <Body>{draft.prompt}</Body>
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setDraft(drawPrompt())}
                  disabled={starting !== null}
                  className="flex-1 items-center rounded-xl border border-border py-3 active:opacity-70"
                >
                  <Mono>Redraw</Mono>
                </Pressable>
                <Pressable
                  onPress={sendDraft}
                  disabled={starting !== null}
                  className="flex-1 items-center rounded-xl bg-primary py-3 active:opacity-80"
                >
                  <Mono style={{ color: '#100F0D' }}>
                    {starting === 'flirt' ? 'Sending…' : 'Send it'}
                  </Mono>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Mono className="px-1">Play something</Mono>
              {ALL_GAMES.map(({ kind, title, blurb }) => {
                const isPlayed = played.has(kind);
                return (
                  <Pressable
                    key={kind}
                    onPress={() =>
                      kind === 'flirt' ? setDraft(drawPrompt()) : playAuto(kind)
                    }
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
                    <Body className="text-sm text-muted-foreground">
                      {blurb}
                    </Body>
                  </Pressable>
                );
              })}
            </>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

export { GameSheet };
