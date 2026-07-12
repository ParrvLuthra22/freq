import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SyncMoment } from '@/components/sync-moment';
import { Body } from '@/components/ui/typography';
import { getUserById } from '@/lib/seed';

export default function SyncByIdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = getUserById(id);

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <View>
          <Body className="text-center text-muted-foreground">That profile wandered off.</Body>
        </View>
      </SafeAreaView>
    );
  }

  return <SyncMoment user={user} onBack={() => router.back()} />;
}
