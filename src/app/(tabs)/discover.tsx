import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiscoveryCard } from '@/components/discovery-card';
import { Display, Mono } from '@/components/ui/typography';
import { getUsers } from '@/lib/seed';

export default function DiscoverScreen() {
  const users = getUsers();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="gap-1 px-6 pb-4 pt-2">
        <Mono>Discover</Mono>
        <Display className="text-3xl leading-tight">Rare overlap,</Display>
        <Display italic className="text-3xl leading-tight text-accent">
          not blind swipes.
        </Display>
      </View>
      <FlatList
        data={users}
        keyExtractor={(user) => user.id}
        contentContainerClassName="gap-4 px-6 pb-16"
        renderItem={({ item }) => <DiscoveryCard user={item} />}
      />
    </SafeAreaView>
  );
}
