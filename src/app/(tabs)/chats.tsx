import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumArt } from '@/components/ui/album-art';
import { Body, Display, Mono } from '@/components/ui/typography';
import { fetchLastMessages, getMatchId, subscribeToAnyMessage, type StoredMessage } from '@/lib/chat';
import { getMe } from '@/lib/seed';
import { useMatches, usePersistedState } from '@/lib/store';

/** One line of preview text for a match, from whatever the DB actually knows. */
function previewFor(message: StoredMessage | undefined, fallback: string, meSlug: string): string {
  if (!message) return fallback;
  if (message.type === 'song') {
    const body = message.body as { title?: string; artist?: string };
    return `${message.senderSlug === meSlug ? 'You: ' : ''}🎵 ${body.title ?? 'a song'}`;
  }
  const text = (message.body as { text?: string }).text ?? '';
  return message.senderSlug === meSlug ? `You: ${text}` : text;
}

/**
 * Driven by matches, the real last message per thread, and the unread flag —
 * all from Supabase once a session exists. In local mode there is no matches
 * table to read, so this falls back to each match's seeded opening line
 * exactly as it always has.
 */
export default function ChatsScreen() {
  const matches = useMatches();
  const { unreadIds } = usePersistedState();
  const me = getMe();

  const [lastByMatchId, setLastByMatchId] = React.useState<Map<string, StoredMessage>>(new Map());
  // The other axis of the same map: which match id belongs to which person, so
  // a realtime insert (keyed by match id) can be applied back onto their row.
  const [matchIdBySlug, setMatchIdBySlug] = React.useState<Map<string, string>>(new Map());

  React.useEffect(() => {
    let cancelled = false;

    Promise.all(matches.map(async (user) => [user.id, await getMatchId(user.id)] as const)).then(
      (pairs) => {
        if (cancelled) return;

        const bySlug = new Map<string, string>();
        for (const [slug, matchId] of pairs) if (matchId) bySlug.set(slug, matchId);
        setMatchIdBySlug(bySlug);

        const ids = [...bySlug.values()];
        if (ids.length === 0) return;
        fetchLastMessages(ids).then((map) => {
          if (!cancelled) setLastByMatchId(map);
        });
      }
    );

    return () => {
      cancelled = true;
    };
    // Re-resolve whenever the match list itself changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.map((u) => u.id).join(',')]);

  React.useEffect(() => {
    const ids = [...matchIdBySlug.values()];
    if (ids.length === 0) return;

    return subscribeToAnyMessage(ids, (message) => {
      setLastByMatchId((prev) => {
        const next = new Map(prev);
        next.set(message.matchId, message);
        return next;
      });
    });
  }, [matchIdBySlug]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-5 pb-14 pt-2" showsVerticalScrollIndicator={false}>
        <View className="gap-1 px-1 pb-5">
          <Mono>
            {matches.length > 0 ? `${matches.length} in sync` : 'No threads yet'}
          </Mono>
          <Display className="text-3xl leading-tight">In sync</Display>
          <Display italic className="text-3xl leading-tight text-accent">
            with you.
          </Display>
        </View>

        {matches.length > 0 ? (
          <View className="gap-2.5">
            {matches.map((user) => {
              const unread = unreadIds.includes(user.id);
              const matchId = matchIdBySlug.get(user.id);
              const last = matchId ? lastByMatchId.get(matchId) : undefined;
              const fallback = user.thread[user.thread.length - 1]?.text ?? user.flirt;

              return (
                <Pressable
                  key={user.id}
                  onPress={() => router.push(`/chat/${user.id}`)}
                  className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3 active:opacity-70">
                  {/* Unsealed: matching is what earns the sharp artwork. */}
                  <AlbumArt seed={user.id} size={50} shape="circle" />

                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <Body className="text-base">{user.name}</Body>
                      {unread ? <View className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                    </View>
                    <Body className="text-xs text-muted-foreground" numberOfLines={1}>
                      {previewFor(last, fallback, me.id)}
                    </Body>
                  </View>

                  <View className="items-end">
                    <Display className="text-xl text-accent">{user.match.score}</Display>
                    <Mono>Freq</Mono>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View className="items-center gap-3 px-6 pt-16">
            <Display className="text-center text-2xl leading-tight">No threads yet.</Display>
            <Display italic className="text-center text-2xl leading-tight text-accent">
              Swipe on someone.
            </Display>
            <Pressable
              onPress={() => router.push('/discover')}
              className="mt-1 rounded-xl border border-border px-5 py-3 active:opacity-70">
              <Mono>Discover →</Mono>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
