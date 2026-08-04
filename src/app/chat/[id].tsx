import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Body, Display, Mono } from '@/components/ui/typography';
import { getIcebreakers } from '@/lib/ai';
import { getMe, getUserById, type ChatMessage } from '@/lib/seed';
import { cn } from '@/lib/utils';

export default function ChatByIdScreen() {
  const { id, opener } = useLocalSearchParams<{ id: string; opener?: string }>();
  const user = getUserById(id);
  const scrollRef = React.useRef<ScrollView>(null);
  // v2 seeds each thread with the line they opened on.
  const [messages, setMessages] = React.useState<ChatMessage[]>(
    () =>
      (user?.thread ?? []).map((entry, i) => ({
        id: `seed-${i}`,
        sender: entry.sender,
        text: entry.text,
        sentAt: new Date().toISOString(),
      }))
  );
  const [draft, setDraft] = React.useState(opener ?? '');
  const [suggestions, setSuggestions] = React.useState<string[] | null>(null);
  const [suggesting, setSuggesting] = React.useState(false);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev: ChatMessage[]) => [
      ...prev,
      { id: `local-${Date.now()}`, sender: 'me', text, sentAt: new Date().toISOString() },
    ]);
    setDraft('');
    setSuggestions(null);
  };

  // §6.3 — refreshable icebreakers, in case the thread stalls.
  const handleSuggest = React.useCallback(async () => {
    if (!user) return;
    setSuggesting(true);
    const me = getMe();
    const result = await getIcebreakers(
      `${me.id}:${user.id}`,
      {
        meName: me.name,
        matchName: user.name,
        reasons: user.match.reasons,
        sharedArtists: user.match.sharedArtists,
        sharedSong: user.match.sharedSong,
      },
      { refresh: true }
    );
    setSuggestions(result.openers);
    setSuggesting(false);
  }, [user]);

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
        <Avatar seed={user.id} name={user.name} size={36} />
        <Body className="flex-1">{user.name}</Body>
        {/* The score in the header doubles as the way into how it was computed. */}
        <Pressable
          onPress={() => router.push(`/breakdown/${user.id}`)}
          hitSlop={8}
          className="items-end px-1 active:opacity-60">
          <Display className="text-xl text-accent">{user.match.score}</Display>
          <Mono>Why →</Mono>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerClassName="gap-3 px-4 py-4"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {/* Why this thread exists, stated once at the top. */}
          <View className="items-center pb-1">
            <View className="rounded-full bg-card px-4 py-2">
              <Mono className="text-center">{user.reason} · Freq {user.match.score}</Mono>
            </View>
          </View>

          {messages.map((message) => (
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

          {messages.length === 0 ? (
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
                  className="rounded-xl border border-border bg-card px-3 py-2 active:opacity-70">
                  <Body className="text-sm">{suggestion}</Body>
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable onPress={handleSuggest} disabled={suggesting} className="self-start active:opacity-60">
              <Mono className="text-accent">
                {suggesting ? 'Thinking of something…' : '✨ Suggest an opener'}
              </Mono>
            </Pressable>
          )}

          <View className="flex-row items-center gap-2">
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
    </SafeAreaView>
  );
}
