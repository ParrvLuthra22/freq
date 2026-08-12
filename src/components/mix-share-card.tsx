import * as React from 'react';
import { View } from 'react-native';

import { TrackArt } from '@/components/ui/track-art';
import { Body, Display, Mono } from '@/components/ui/typography';
import type { MixTrack } from '@/lib/mix';

const CARD_WIDTH = 300;
const CARD_HEIGHT = Math.round((CARD_WIDTH * 16) / 9);
const MAX_TILES = 9;
const TILES_PER_ROW = 3;
const TILE_GAP = 6;
const CARD_PADDING_X = 24;
const TILE_SIZE =
  (CARD_WIDTH - CARD_PADDING_X * 2 - TILE_GAP * (TILES_PER_ROW - 1)) /
  TILES_PER_ROW;

type MixShareCardProps = {
  meName: string;
  matchName: string;
  tracks: MixTrack[];
  /**
   * Resolved cover URLs keyed `title::artist`.
   *
   * The caller owns these because it must *prefetch* them before capturing:
   * `captureRef` snapshots whatever is painted at that instant, so an image
   * still in flight is captured as a hole. See `handleShare` in `/mix/[id]`.
   */
  art?: Map<string, string>;
};

/**
 * The Mix's shareable image — same fixed 9:16 brand-dark card as `ShareCard`,
 * captured the same way (`react-native-view-shot` + `expo-sharing`, see
 * `/mix/[id].tsx`). A separate component rather than extending `ShareCard`:
 * the tile grid is a genuinely different layout, not a variant of the score
 * dial one.
 */
const MixShareCard = React.forwardRef<View, MixShareCardProps>(
  function MixShareCard({ meName, matchName, tracks, art }, ref) {
    const shown = tracks.slice(-MAX_TILES);

    return (
      <View
        ref={ref}
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
        className="items-center justify-between overflow-hidden rounded-3xl bg-ink px-6 py-8"
      >
        <Mono className="text-champagne">Freq</Mono>

        <View className="items-center gap-1">
          <Body className="text-ivory">
            {meName} × {matchName}
          </Body>
          <Display
            italic
            className="text-center text-2xl leading-tight text-signal"
          >
            The Mix
          </Display>
        </View>

        {shown.length > 0 ? (
          <View
            style={{
              width: CARD_WIDTH - CARD_PADDING_X * 2,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: TILE_GAP,
            }}
          >
            {shown.map((t) => (
              <TrackArt
                key={t.id}
                title={t.track.title}
                artist={t.track.artist}
                url={art?.get(`${t.track.title}::${t.track.artist}`)}
                size={TILE_SIZE}
                shape="square"
              />
            ))}
          </View>
        ) : (
          <Body className="text-center text-ash">Nothing added yet.</Body>
        )}

        <View className="items-center gap-1">
          <Mono className="text-ash">Tracks</Mono>
          <Body className="text-ivory">{tracks.length}</Body>
        </View>
      </View>
    );
  },
);

export { MixShareCard, CARD_HEIGHT, CARD_WIDTH };
export type { MixShareCardProps };
