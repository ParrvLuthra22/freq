import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import {
  MixAddSheet,
  type MixAddSheetHandle,
} from '@/components/mix-add-sheet';
import { MixShareCard } from '@/components/mix-share-card';
import { AlbumArt } from '@/components/ui/album-art';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import { useAuth } from '@/lib/auth';
import { getMatchId } from '@/lib/chat';
import {
  fetchMixTracks,
  subscribeToMixTracks,
  triggerMockMixAdd,
  type MixTrack,
} from '@/lib/mix';
import { getMe, getUserById } from '@/lib/seed';
import { useReconciled } from '@/lib/store';

/**
 * The FREQ Mix — a growing shared playlist for one match.
 *
 * Two ways in: the "add to FREQ Mix" action on a song message in chat, and the
 * search-backed picker on this screen. The second exists because the first
 * required already having sent the song to each other, which made the Mix feel
 * like a byproduct of the thread rather than a thing you build together.
 */
export default function MixScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = getUserById(id);
  const me = getMe();
  const { mode } = useAuth();
  const reconciled = useReconciled();

  const [matchId, setMatchId] = React.useState<string | null>(null);
  const [tracks, setTracks] = React.useState<MixTrack[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const shareCardRef = React.useRef<View>(null);
  const addSheetRef = React.useRef<MixAddSheetHandle>(null);

  React.useEffect(() => {
    if (!user) return;
    // See chat/[id].tsx's identical guard: a signed-in session's profile id
    // isn't populated until reconciliation finishes, so reading it too early
    // (a hard reload, a direct deep link) would wrongly conclude "no match."
    if (mode === 'signed-in' && !reconciled) return;
    let cancelled = false;

    getMatchId(user.id).then((mid) => {
      if (cancelled) return;
      if (!mid) {
        // No match to sync through (local mode, or no match row yet) —
        // nothing left to wait on, so this counts as "loaded" too.
        setLoaded(true);
        return;
      }
      setMatchId(mid);
      fetchMixTracks(mid).then((rows) => {
        if (!cancelled) {
          setTracks(rows);
          setLoaded(true);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [user, mode, reconciled]);

  React.useEffect(() => {
    if (!matchId) return;
    return subscribeToMixTracks(matchId, (track) => {
      setTracks((prev) =>
        prev.some((t) => t.id === track.id) ? prev : [...prev, track],
      );
    });
  }, [matchId]);

  const contributorName = React.useCallback(
    (slug: string) =>
      slug === me.id ? me.name : (getUserById(slug)?.name ?? 'Someone'),
    [me.id, me.name],
  );

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share the Mix',
        });
      }
    } catch (error) {
      // Sharing can be cancelled or unavailable (no share target, web's stricter
      // Web Share API) — fail quietly rather than leaving the screen broken.
      console.warn('Share failed', error);
    } finally {
      setBusy(false);
    }
  };

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
          <View className="flex-1">
            <Body>The Mix</Body>
            <Mono>
              {me.name} × {user.name}
            </Mono>
          </View>
          <Mono className="text-accent">{tracks.length} tracks</Mono>
        </View>

        <ScrollView contentContainerClassName="gap-4 px-4 py-4">
          {!loaded ? (
            <View className="flex-row flex-wrap gap-3">
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  className="gap-2 overflow-hidden rounded-2xl border border-border bg-card p-2.5"
                  style={{ width: '48%' }}
                >
                  <Skeleton className="aspect-square w-full rounded-xl" />
                  <Skeleton className="h-4 w-4/5 rounded" />
                  <Skeleton className="h-3 w-3/5 rounded" />
                </View>
              ))}
            </View>
          ) : tracks.length === 0 ? (
            <View className="items-center gap-2 px-6 pt-16">
              <Display className="text-center text-2xl leading-tight">
                Nothing here yet.
              </Display>
              <Body className="text-center text-muted-foreground">
                Search for one below, or send {user.name} a song in your thread
                — either way it lands here for both of you.
              </Body>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-3">
              {tracks
                .slice()
                .reverse()
                .map((t) => (
                  <View
                    key={t.id}
                    className="gap-2 overflow-hidden rounded-2xl border border-border bg-card p-2.5"
                    style={{ width: '48%' }}
                  >
                    <AlbumArt
                      seed={`${t.track.title}-${t.track.artist}`}
                      shape="square"
                      fill
                    />
                    <Body className="text-sm" numberOfLines={1}>
                      {t.track.title}
                    </Body>
                    <Mono numberOfLines={1}>{t.track.artist}</Mono>
                    <View className="flex-row items-center gap-1.5">
                      <Avatar
                        seed={t.addedBySlug}
                        name={contributorName(t.addedBySlug)}
                        size={18}
                      />
                      <Mono>{contributorName(t.addedBySlug)}</Mono>
                    </View>
                  </View>
                ))}
            </View>
          )}
        </ScrollView>

        <View className="gap-2 border-t border-border px-4 py-3">
          {/* Adding needs a real match to sync through, same as the games and
            the Mix link in chat — nothing to contribute to in local mode. */}
          {matchId ? (
            <Pressable
              onPress={() => addSheetRef.current?.present()}
              className="items-center rounded-2xl border border-border py-3.5 active:opacity-70"
            >
              <Mono className="text-accent">+ Add a song</Mono>
            </Pressable>
          ) : null}
          <Button
            size="lg"
            onPress={handleShare}
            disabled={busy || tracks.length === 0}
          >
            <Text>{busy ? 'Preparing…' : 'Share this Mix'}</Text>
          </Button>
        </View>

        {/* Off-screen — exists only so `captureRef` has something to snapshot. */}
        <View
          style={{ position: 'absolute', top: -9999, left: -9999 }}
          pointerEvents="none"
        >
          <MixShareCard
            ref={shareCardRef}
            meName={me.name}
            matchName={user.name}
            tracks={tracks}
          />
        </View>

        <MixAddSheet
          ref={addSheetRef}
          matchId={matchId}
          onAdded={(track) => {
            // Optimistic, and de-duped against the realtime INSERT that will
            // arrive for the same row a moment later.
            setTracks((prev) =>
              prev.some((t) => t.id === track.id) ? prev : [...prev, track],
            );
            if (user.isMock && matchId)
              void triggerMockMixAdd(matchId).catch(() => {});
          }}
        />
      </SafeAreaView>
    </BottomSheetModalProvider>
  );
}
