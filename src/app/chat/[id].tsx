import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Body, Mono } from '@/components/ui/typography';
import { getUserById } from '@/lib/seed';
import { cn } from '@/lib/utils';

export default function ChatByIdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = getUserById(id);
  const scrollRef = React.useRef<ScrollView>(null);

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Body className="text-center text-muted-foreground">That thread wandered off.</Body>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} className="px-2 py-1 active:opacity-60">
          <Mono>Back</Mono>
        </Pressable>
        <Avatar name={user.name} gradient={user.avatarGradient} size={36} />
        <Body>{user.name}</Body>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerClassName="gap-3 px-4 py-4"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {user.opener ? (
            <View className="items-center pb-1">
              <View className="rounded-full bg-card px-4 py-2">
                <Mono className="text-center">{user.opener}</Mono>
              </View>
            </View>
          ) : null}

          {(user.chatThread ?? []).map((message) => (
            <View
              key={message.id}
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5',
                message.sender === 'me' ? 'self-end bg-primary' : 'self-start bg-card'
              )}>
              <Body className={message.sender === 'me' ? 'text-primary-foreground' : 'text-card-foreground'}>
                {message.text}
              </Body>
            </View>
          ))}

          {!user.chatThread || user.chatThread.length === 0 ? (
            <Body className="pt-2 text-center text-muted-foreground">
              No messages yet — say something.
            </Body>
          ) : null}
        </ScrollView>

        <View className="flex-row items-center gap-2 border-t border-border px-4 py-3">
          <TextInput
            placeholder="Say something…"
            placeholderClassName="text-muted-foreground"
            className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 font-body text-foreground"
          />
          <Button size="icon">
            <Text>→</Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
