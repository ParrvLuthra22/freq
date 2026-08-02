import * as React from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiscoveryCard } from '@/components/discovery-card';
import { Body, Display, Mono } from '@/components/ui/typography';
import { useDailyDrop } from '@/lib/store';

/** Hours until the next drop, so the empty state can say something true. */
function hoursUntilTomorrow(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  return Math.max(1, Math.round((tomorrow.getTime() - now.getTime()) / 3_600_000));
}

export default function DiscoverScreen() {
  // Once you've reacted to someone they leave the drop — the set is finite and
  // spends down, which is what makes each one feel considered.
  const { drop, remaining } = useDailyDrop();
  const spent = drop.length - remaining.length;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="gap-1 px-6 pb-4 pt-2">
        <Mono>
          Today · {remaining.length} of {drop.length}
        </Mono>
        <Display className="text-3xl leading-tight">Rare overlap,</Display>
        <Display italic className="text-3xl leading-tight text-accent">
          not blind swipes.
        </Display>
      </View>

      {remaining.length > 0 ? (
        <FlatList
          data={remaining}
          keyExtractor={(user) => user.id}
          contentContainerClassName="gap-4 px-6 pb-16"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <DiscoveryCard user={item} />}
        />
      ) : (
        <View className="flex-1 items-center justify-center gap-3 px-10 pb-16">
          <Display className="text-center text-3xl leading-tight">That&apos;s everyone</Display>
          <Display italic className="text-center text-3xl leading-tight text-accent">
            for today.
          </Display>
          <Body className="pt-1 text-center text-muted-foreground">
            {spent > 0
              ? 'Four a day, chosen on overlap — not on how long you can keep scrolling.'
              : 'Nothing in range right now. Check back once more people are listening.'}
          </Body>
          <Mono className="pt-2">Next drop in {hoursUntilTomorrow()}h</Mono>
        </View>
      )}
    </SafeAreaView>
  );
}
