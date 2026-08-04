import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumArt } from '@/components/ui/album-art';
import { Body, Display, Mono } from '@/components/ui/typography';
import { useMatches, usePersistedState } from '@/lib/store';

export default function ChatsScreen() {
  const matches = useMatches();
  const { unreadIds } = usePersistedState();

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
              const lastLine = user.thread[user.thread.length - 1]?.text ?? user.flirt;

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
                      {lastLine}
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
