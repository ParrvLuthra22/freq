import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import { FreqDial } from '@/components/ui/freq-dial';
import { RhythmChart } from '@/components/ui/rhythm-chart';
import { Body, Display, Mono } from '@/components/ui/typography';
import { getMe, getPairScore, getUserById } from '@/lib/seed';
import { THEME } from '@/lib/theme';
import type { ScoredComponent } from '@/lib/score';

/** A rare artist by the same threshold the profile uses for its "Rare" chip. */
const RARE_RANK = 35;

function Chip({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View
      className={
        accent
          ? 'rounded-full border border-accent bg-accent/10 px-3 py-1.5'
          : 'rounded-full border border-border bg-card px-3 py-1.5'
      }>
      <Mono className={accent ? 'text-accent' : 'text-foreground'}>{label}</Mono>
    </View>
  );
}

/**
 * One weighted component: how strong the signal is, and the evidence behind it.
 *
 * The bar shows the raw component value rather than its contribution, so a short
 * bar reads honestly as "this signal is weak" instead of "this barely counts".
 */
function ComponentRow({
  component,
  index,
  children,
}: {
  component: ScoredComponent;
  index: number;
  children?: React.ReactNode;
}) {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const progress = useSharedValue(0);

  React.useEffect(() => {
    // Staggered so the five components read as a sequence being worked out.
    progress.value = withDelay(
      140 * index,
      withTiming(component.value * 100, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, [component.value, index, progress]);

  // Animated.View drops NativeWind className styles when a style prop is also
  // present, so the fill's appearance travels entirely through style.
  const fill = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
    height: '100%',
    borderRadius: 9999,
    backgroundColor: theme.accent,
  }));

  return (
    <View className="gap-2.5 border-t border-border py-5">
      <View className="flex-row items-baseline justify-between">
        <Mono className="text-foreground">{component.label}</Mono>
        <Mono>{Math.round(component.value * 100)}%</Mono>
      </View>

      <View className="h-1.5 overflow-hidden rounded-full bg-muted">
        <Animated.View style={fill} />
      </View>

      <Mono className="text-[10px]">Weighted ×{component.weight.toFixed(2)}</Mono>

      {children ? <View className="pt-1.5">{children}</View> : null}
    </View>
  );
}

/** The "why this score" screen — the algorithm, shown rather than asserted. */
export default function BreakdownScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = getUserById(id);
  const scored = getPairScore(id);
  const me = getMe();

  if (!user || !scored) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Body className="text-center text-muted-foreground">
          Nothing to break down — that profile wandered off.
        </Body>
      </SafeAreaView>
    );
  }

  const byKey = (key: string) => scored.components.find((c) => c.key === key);
  const rareShared = scored.sharedArtists.filter((name) => {
    const artist = user.topArtists.find((a) => a.name === name);
    return artist !== undefined && artist.rank < RARE_RANK;
  });

  const artistOverlap = byKey('artistOverlap');
  const trackOverlap = byKey('trackOverlap');
  const tagSimilarity = byKey('tagSimilarity');
  const depthBridge = byKey('depthBridge');
  const rhythmMatch = byKey('rhythmMatch');

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-2 px-6 pb-16" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} className="self-start py-3">
          <Mono className="text-accent">← Back</Mono>
        </Pressable>

        <Mono>The breakdown</Mono>
        <View className="pb-2">
          <Display className="text-4xl leading-tight">Why you and</Display>
          <Display italic className="text-4xl leading-tight text-accent">
            {user.name}.
          </Display>
        </View>

        <View className="items-center py-4">
          <FreqDial score={scored.score} size={180} label="Freq" />
        </View>

        {scored.reasons.length > 0 ? (
          <View className="gap-2 rounded-2xl border border-border bg-card p-4">
            {scored.reasons.map((reason) => (
              <Body key={reason} className="text-foreground">
                — {reason}
              </Body>
            ))}
          </View>
        ) : null}

        <Mono className="pt-6">How it&apos;s calculated</Mono>

        {artistOverlap ? (
          <ComponentRow component={artistOverlap} index={0}>
            {scored.sharedArtists.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {scored.sharedArtists.map((name) => (
                  <Chip key={name} label={name} accent={rareShared.includes(name)} />
                ))}
              </View>
            ) : (
              <Body className="text-sm text-muted-foreground">No artists in common yet.</Body>
            )}
          </ComponentRow>
        ) : null}

        {trackOverlap ? (
          <ComponentRow component={trackOverlap} index={1}>
            {scored.sharedTracks.length > 0 ? (
              <View className="gap-1">
                {scored.sharedTracks.slice(0, 3).map((track) => (
                  <Body key={`${track.artist}-${track.title}`} className="text-foreground">
                    {track.title} <Body className="text-muted-foreground">— {track.artist}</Body>
                  </Body>
                ))}
              </View>
            ) : (
              <Body className="text-sm text-muted-foreground">
                Same artists, different songs — that happens.
              </Body>
            )}
          </ComponentRow>
        ) : null}

        {tagSimilarity ? (
          <ComponentRow component={tagSimilarity} index={2}>
            {scored.sharedTags.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {scored.sharedTags.map((tag) => (
                  <Chip key={tag} label={tag} />
                ))}
              </View>
            ) : (
              <Body className="text-sm text-muted-foreground">
                Your taste worlds barely touch — which is its own kind of interesting.
              </Body>
            )}
          </ComponentRow>
        ) : null}

        {depthBridge ? (
          <ComponentRow component={depthBridge} index={3}>
            {scored.bridges.length > 0 ? (
              <View className="gap-1">
                {scored.bridges.map((bridge) => (
                  <Body key={`${bridge.from}-${bridge.to}`} className="text-foreground">
                    {bridge.from}{' '}
                    <Body className="text-muted-foreground">sits next to their</Body> {bridge.to}
                  </Body>
                ))}
              </View>
            ) : (
              <Body className="text-sm text-muted-foreground">
                No near-misses — what you share, you share outright.
              </Body>
            )}
          </ComponentRow>
        ) : null}

        {rhythmMatch ? (
          <ComponentRow component={rhythmMatch} index={4}>
            <RhythmChart
              mine={me.listeningHours}
              theirs={user.listeningHours}
              overlapHours={scored.overlapHours}
              theirName={user.name}
            />
          </ComponentRow>
        ) : null}

        <Body className="border-t border-border pt-5 text-sm text-muted-foreground">
          Each signal is weighted and combined into the score above. Rarity is measured against
          everyone else on FREQ — sharing an artist nobody else listens to counts for far more
          than sharing one everybody does.
        </Body>
      </ScrollView>
    </SafeAreaView>
  );
}
