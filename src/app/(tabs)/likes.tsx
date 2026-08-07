import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumArt } from '@/components/ui/album-art';
import { Body, Display, Mono } from '@/components/ui/typography';
import { getAdmirers, getUserById, type DiscoverUser } from '@/lib/seed';
import { like, usePersistedState } from '@/lib/store';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';

type Tab = 'in' | 'out';

export default function LikesScreen() {
  const { likedIds, matchIds, passedIds, admirerIds } = usePersistedState();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const [tab, setTab] = React.useState<Tab>('in');

  // Inbound: they swiped right on you and you have not decided yet. Prefers
  // the real `likes` rows synced from Supabase; falls back to the seed's
  // static `likedYou` pretence only when nothing has synced yet — local mode,
  // or a signed-in account before its first reconcile has landed.
  const inbound = React.useMemo(() => {
    const admirers = admirerIds.map(getUserById).filter((user): user is DiscoverUser => user !== undefined);
    const source = admirers.length > 0 ? admirers : getAdmirers();
    return source.filter((user) => !likedIds.includes(user.id) && !passedIds.includes(user.id));
  }, [admirerIds, likedIds, passedIds]);

  // Outbound: you swiped right, and it has not come back mutual yet.
  const outbound = React.useMemo(
    () =>
      likedIds
        .filter((id) => !matchIds.includes(id))
        .map((id) => getUserById(id))
        .filter((user): user is DiscoverUser => user !== undefined),
    [likedIds, matchIds]
  );

  const rows = tab === 'in' ? inbound : outbound;

  const onLikeBack = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    like(userId);
    router.push(`/reveal/${userId}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-5 pb-14 pt-2" showsVerticalScrollIndicator={false}>
        <View className="gap-1 px-1 pb-4">
          <Mono>
            {inbound.length > 0 ? `${inbound.length} waiting` : 'Nobody waiting'}
          </Mono>
          <Display className="text-3xl leading-tight">Someone&apos;s</Display>
          <Display italic className="text-3xl leading-tight text-accent">
            already listening.
          </Display>
        </View>

        <View className="flex-row gap-2 pb-4">
          {(
            [
              ['in', 'Liked you'],
              ['out', 'You liked'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              className={cn(
                'rounded-full border px-4 py-2 active:opacity-70',
                tab === key ? 'border-accent bg-accent/10' : 'border-border'
              )}>
              <Mono className={tab === key ? 'text-accent' : undefined}>{label}</Mono>
            </Pressable>
          ))}
        </View>

        {rows.length > 0 ? (
          <View className="flex-row flex-wrap gap-3">
            {rows.map((user) => (
              <View
                key={user.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
                style={{ width: '48%' }}>
                <View>
                  <AlbumArt seed={user.week.artist} shape="square" fill />
                  {/* Still sealed — nothing here is mutual yet. */}
                  <BlurView
                    intensity={12}
                    tint={theme.background === '#100F0D' ? 'dark' : 'light'}
                    style={{ position: 'absolute', inset: 0 }}
                  />
                  <View
                    className="absolute right-2 top-2 rounded-full px-2 py-1"
                    style={{ backgroundColor: theme.background }}>
                    <Display className="text-sm text-accent">{user.match.score}</Display>
                  </View>
                  <View className="absolute inset-x-3 bottom-2">
                    <Display className="text-lg leading-tight">{user.name}</Display>
                    <Mono className="text-accent">{user.week.artist}</Mono>
                  </View>
                </View>

                <View className="gap-2.5 px-3 pb-3 pt-2.5">
                  <Body className="text-xs leading-snug text-muted-foreground">
                    {tab === 'in' ? user.reasonSoft : 'Waiting on them.'}
                  </Body>
                  {tab === 'in' ? (
                    <Pressable
                      onPress={() => onLikeBack(user.id)}
                      className="items-center rounded-xl bg-primary py-2.5 active:opacity-80">
                      <Mono style={{ color: '#100F0D' }}>Like back</Mono>
                    </Pressable>
                  ) : (
                    <View className="items-center rounded-xl border border-border py-2.5">
                      <Mono>Sent</Mono>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="items-center gap-3 px-6 pt-16">
            <Display className="text-center text-2xl leading-tight">Nothing here yet.</Display>
            <Display italic className="text-center text-2xl leading-tight text-accent">
              Go be brave.
            </Display>
            <Pressable
              onPress={() => router.push('/discover')}
              className="mt-1 rounded-xl border border-border px-5 py-3 active:opacity-70">
              <Mono>Discover →</Mono>
            </Pressable>
          </View>
        )}

        <Mono className="px-1 pt-6">Faces stay sealed until it&apos;s mutual.</Mono>
      </ScrollView>
    </SafeAreaView>
  );
}
