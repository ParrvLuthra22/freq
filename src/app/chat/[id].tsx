import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
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

import { GameSheet, type GameSheetHandle } from '@/components/game-sheet';
import { QuizCard } from '@/components/quiz-card';
import { TakeCard } from '@/components/take-card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import { getIcebreakers } from '@/lib/ai';
import {
  fetchMessages,
  getMatchId,
  sendMessage,
  subscribeToThread,
  triggerMockReply,
  type SongBody,
  type StoredMessage,
} from '@/lib/chat';
import { markRead } from '@/lib/store';
import { getMe, getUserById } from '@/lib/seed';

/**
 * One rendered line in the thread — the DB's `StoredMessage` plus a locally
 * generated one waiting on its round trip. `pending` is dropped the moment the
 * real row for it lands, whether that arrives as the insert's own return value
 * or, for anyone else's message, over realtime.
 */
type Line = {
  id: string;
  fromMe: boolean;
  type: StoredMessage['type'];
  body: Record<string, unknown>;
  pending?: boolean;
};

function fromStored(message: StoredMessage, meSlug: string): Line {
  return {
    id: message.id,
    fromMe: message.senderSlug === meSlug,
    type: message.type,
    body: message.body,
  };
}

export default function ChatByIdScreen() {
  const { id, opener } = useLocalSearchParams<{
    id: string;
    opener?: string;
  }>();
  const user = getUserById(id);
  const me = getMe();
  const scrollRef = React.useRef<ScrollView>(null);

  // Seed the thread with the opening line until the real history (or the
  // absence of one — no match row yet, or no project configured) resolves.
  const [lines, setLines] = React.useState<Line[]>(() =>
    (user?.thread ?? []).map((entry, i) => ({
      id: `seed-${i}`,
      fromMe: entry.sender === 'me',
      type: 'text' as const,
      body: { text: entry.text },
    })),
  );
  const [matchId, setMatchId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState(opener ?? '');
  const [suggestions, setSuggestions] = React.useState<string[] | null>(null);
  const [suggesting, setSuggesting] = React.useState(false);
  const gameSheetRef = React.useRef<GameSheetHandle>(null);

  // Opening a thread — from anywhere, not just the reveal screen — is what
  // earns it being read.
  React.useEffect(() => {
    if (user) markRead(user.id);
  }, [user]);

  // Resolve the match, load its real history, and stay subscribed to it.
  // Local mode (no project, or no match row yet) leaves the seeded thread as
  // the whole conversation, exactly as it already behaved before Supabase.
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getMatchId(user.id).then((mid) => {
      if (cancelled || !mid) return;
      setMatchId(mid);

      fetchMessages(mid).then((history) => {
        if (cancelled || history.length === 0) return;
        setLines(history.map((m) => fromStored(m, me.id)));
      });
    });

    return () => {
      cancelled = true;
    };
  }, [user, me.id]);

  React.useEffect(() => {
    if (!matchId) return;

    return subscribeToThread(matchId, (message) => {
      // Our own message already exists locally via the optimistic insert —
      // realtime would otherwise echo it back as a second line.
      if (message.senderSlug === me.id) return;
      setLines((prev) =>
        prev.some((line) => line.id === message.id)
          ? prev
          : [...prev, fromStored(message, me.id)],
      );
    });
  }, [matchId, me.id]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || !user) return;

    const tempId = `local-${Date.now()}`;
    setLines((prev) => [
      ...prev,
      { id: tempId, fromMe: true, type: 'text', body: { text }, pending: true },
    ]);
    setDraft('');
    setSuggestions(null);

    if (!matchId) return; // Local mode: the optimistic line above is the whole write.

    sendMessage(matchId, 'text', { text }).then((saved) => {
      setLines((prev) =>
        prev.map((line) =>
          line.id === tempId
            ? saved
              ? fromStored(saved, me.id)
              : { ...line, pending: false }
            : line,
        ),
      );

      // Fire-and-forget — the reply itself arrives as an ordinary realtime
      // INSERT a few seconds later, not as anything in this response. A real
      // signed-in match never reaches this: the function checks is_mock itself
      // and no-ops, but skipping the call here saves the round trip.
      if (saved && user.isMock) void triggerMockReply(matchId).catch(() => {});
    });
  };

  // The sheet already did the actual writes (game_sessions row, then this
  // message) — this only mirrors the new line into the thread and, for a mock
  // opponent, asks mock-reply to make their move the same way a text send
  // asks it for a reply.
  const handleGameStarted = (message: StoredMessage) => {
    setLines((prev) => [...prev, fromStored(message, me.id)]);
    if (user && user.isMock && matchId) void triggerMockReply(matchId).catch(() => {});
  };

  // §6.3 — refreshable icebreakers, in case the thread stalls.
  const handleSuggest = React.useCallback(async () => {
    if (!user) return;
    setSuggesting(true);
    const result = await getIcebreakers(
      `${me.id}:${user.id}`,
      {
        meName: me.name,
        matchName: user.name,
        reasons: user.match.reasons,
        sharedArtists: user.match.sharedArtists,
        sharedSong: user.match.sharedSong,
      },
      { refresh: true },
    );
    setSuggestions(result.openers);
    setSuggesting(false);
  }, [user, me]);

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Body className="text-center text-muted-foreground">
          That thread wandered off.
        </Body>
      </SafeAreaView>
    );
  }

  return (
    <BottomSheetModalProvider>
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="px-2 py-1 active:opacity-60"
          >
            <Mono>Back</Mono>
          </Pressable>
          <Avatar seed={user.id} name={user.name} size={36} />
          <Body className="flex-1">{user.name}</Body>
          {/* The score in the header doubles as the way into how it was computed. */}
          <Pressable
            onPress={() => router.push(`/breakdown/${user.id}`)}
            hitSlop={8}
            className="items-end px-1 active:opacity-60"
          >
            <Display className="text-xl text-accent">
              {user.match.score}
            </Display>
            <Mono>Why →</Mono>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerClassName="gap-3 px-4 py-4"
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: false })
            }
          >
            {/* Why this thread exists, stated once at the top. */}
            <View className="items-center pb-1">
              <View className="rounded-full bg-card px-4 py-2">
                <Mono className="text-center">
                  {user.reason} · Freq {user.match.score}
                </Mono>
              </View>
            </View>

            {lines.map((line) =>
              line.type === 'quiz' ? (
                <QuizCard
                  key={line.id}
                  sessionId={String(
                    (line.body as { session_id?: string }).session_id ?? '',
                  )}
                  mockName={user.name}
                />
              ) : line.type === 'take' ? (
                <TakeCard
                  key={line.id}
                  sessionId={String(
                    (line.body as { session_id?: string }).session_id ?? '',
                  )}
                  mockName={user.name}
                />
              ) : line.type === 'song' ? (
                <View
                  key={line.id}
                  className={
                    line.fromMe
                      ? 'max-w-[80%] gap-0.5 self-end rounded-2xl border border-accent bg-accent/10 px-4 py-2.5'
                      : 'max-w-[80%] gap-0.5 self-start rounded-2xl border border-border bg-card px-4 py-2.5'
                  }
                >
                  <Mono className="text-accent">Shared song</Mono>
                  <Body>
                    {(line.body as SongBody).title} —{' '}
                    {(line.body as SongBody).artist}
                  </Body>
                </View>
              ) : (
                <View
                  key={line.id}
                  style={line.pending ? { opacity: 0.6 } : undefined}
                  className={
                    line.fromMe
                      ? 'max-w-[80%] self-end rounded-2xl bg-primary px-4 py-2.5'
                      : 'max-w-[80%] self-start rounded-2xl bg-card px-4 py-2.5'
                  }
                >
                  <Body
                    className={
                      line.fromMe
                        ? 'text-primary-foreground'
                        : 'text-card-foreground'
                    }
                  >
                    {String((line.body as { text?: string }).text ?? '')}
                  </Body>
                </View>
              ),
            )}

            {lines.length === 0 ? (
              <Body className="pt-2 text-center text-muted-foreground">
                No messages yet — say something.
              </Body>
            ) : null}
          </ScrollView>

          <View className="gap-2 border-t border-border px-4 py-3">
            {suggestions ? (
              <View className="gap-2 pb-1">
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => {
                      setDraft(suggestion);
                      setSuggestions(null);
                    }}
                    className="rounded-xl border border-border bg-card px-3 py-2 active:opacity-70"
                  >
                    <Body className="text-sm">{suggestion}</Body>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable
                onPress={handleSuggest}
                disabled={suggesting}
                className="self-start active:opacity-60"
              >
                <Mono className="text-accent">
                  {suggesting
                    ? 'Thinking of something…'
                    : '✨ Suggest an opener'}
                </Mono>
              </Pressable>
            )}

            <View className="flex-row items-center gap-2">
              {/* Games need a real match to sync through — nothing meaningful
                to offer in local mode. */}
              {matchId ? (
                <Pressable
                  onPress={() => gameSheetRef.current?.present()}
                  hitSlop={8}
                  className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
                >
                  <Body className="text-lg text-accent">◇</Body>
                </Pressable>
              ) : null}
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                placeholder="Say something…"
                placeholderClassName="text-muted-foreground"
                className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 font-body text-foreground"
              />
              <Button size="icon" onPress={handleSend} disabled={!draft.trim()}>
                <Text>→</Text>
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>

        <GameSheet
          ref={gameSheetRef}
          matchId={matchId}
          mock={user}
          onStarted={handleGameStarted}
        />
      </SafeAreaView>
    </BottomSheetModalProvider>
  );
}
