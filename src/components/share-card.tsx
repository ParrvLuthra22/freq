import * as React from 'react';
import { View } from 'react-native';

import { FreqDial } from '@/components/ui/freq-dial';
import { Body, Display, Mono } from '@/components/ui/typography';
import type { DiscoverUser, Me } from '@/lib/seed';

const CARD_WIDTH = 300;
const CARD_HEIGHT = Math.round((CARD_WIDTH * 16) / 9);

function splitLast(name: string) {
  const words = name.trim().split(' ');
  const accent = words.pop() ?? '';
  return { lead: words.join(' '), accent };
}

type ShareCardProps = {
  variant: 'solo' | 'pair';
  me: Me;
  match?: DiscoverUser;
};

/**
 * The 9:16 shareable card. Always renders the fixed brand-dark palette (via
 * FreqDial's `theme="dark"` and raw brand tokens) regardless of the viewer's
 * current app theme — a share card is a fixed brand asset, not a themed screen.
 */
const ShareCard = React.forwardRef<View, ShareCardProps>(function ShareCard(
  { variant, me, match },
  ref
) {
  const energyValues = Object.values(me.energy);
  const soloScore = Math.round(energyValues.reduce((a, b) => a + b, 0) / energyValues.length);
  const score = variant === 'pair' && match ? match.match.score : soloScore;
  const { lead, accent } = splitLast(me.archetype.name);

  const stats =
    variant === 'pair' && match
      ? [
          { label: 'Shared artists', value: String(match.match.sharedArtists.length) },
          { label: 'Your song', value: match.match.sharedSong?.title ?? '—' },
        ]
      : [
          { label: 'Top artist', value: me.topArtists[0]?.name ?? '—' },
          { label: 'Night energy', value: String(me.energy.night) },
        ];

  return (
    <View
      ref={ref}
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      className="items-center justify-between overflow-hidden rounded-3xl bg-ink px-6 py-8">
      <Mono className="text-champagne">Freq</Mono>

      <View className="items-center gap-5">
        <FreqDial score={score} size={150} theme="dark" />
        {variant === 'pair' && match ? (
          <View className="items-center">
            <Body className="text-ivory">
              {me.name} × {match.name}
            </Body>
            <Display italic className="text-center text-2xl leading-tight text-signal">
              In sync
            </Display>
          </View>
        ) : (
          <View className="items-center">
            <Body className="text-ivory">{me.name}</Body>
            <Display className="text-center text-2xl leading-tight text-ivory">{lead}</Display>
            <Display italic className="text-center text-2xl leading-tight text-signal">
              {accent}
            </Display>
          </View>
        )}
      </View>

      <View className="w-full flex-row justify-around">
        {stats.map((stat) => (
          <View key={stat.label} className="max-w-[45%] items-center gap-1 px-2">
            <Mono className="text-ash">{stat.label}</Mono>
            <Body className="text-center text-sm text-ivory">{stat.value}</Body>
          </View>
        ))}
      </View>
    </View>
  );
});

export { ShareCard, CARD_HEIGHT, CARD_WIDTH };
export type { ShareCardProps };
