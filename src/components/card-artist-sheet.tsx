import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as React from 'react';
import { Pressable, ScrollView } from 'react-native';

import { Body, Mono } from '@/components/ui/typography';
import { getMe } from '@/lib/seed';
import { setCardArtist, usePersistedState } from '@/lib/store';
import { cn } from '@/lib/utils';

export type CardArtistSheetHandle = { present: () => void };

/**
 * Picks which of your own top artists is "the artist people meet you
 * through" — `cardArtist` in the store, `card_artist` in the DB. A null
 * `cardArtist` falls back to your #1, which this sheet shows as the
 * selected row so the picker never looks like nothing is chosen.
 */
const CardArtistSheet = React.forwardRef<CardArtistSheetHandle>(
  function CardArtistSheet(_props, ref) {
    const sheetRef = React.useRef<BottomSheetModal>(null);
    const { cardArtist } = usePersistedState();
    const me = getMe();
    const current = cardArtist ?? me.topArtists[0]?.name ?? null;

    React.useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
    }));

    const pick = (artist: string) => {
      setCardArtist(artist);
      sheetRef.current?.dismiss();
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['55%']}
        backgroundStyle={{ backgroundColor: '#1B1815' }}
        handleIndicatorStyle={{ backgroundColor: '#8B857A' }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
          />
        )}
      >
        <BottomSheetView className="gap-1 px-5 pt-2" style={{ flex: 1 }}>
          <Mono className="px-1 pb-2">The artist people meet you through</Mono>
          <ScrollView contentContainerClassName="gap-2 pb-8">
            {me.topArtists.map((artist) => {
              const selected = artist.name === current;
              return (
                <Pressable
                  key={artist.name}
                  onPress={() => pick(artist.name)}
                  className={cn(
                    'flex-row items-center justify-between rounded-2xl border px-4 py-3.5 active:opacity-70',
                    selected ? 'border-accent bg-accent/10' : 'border-border',
                  )}
                >
                  <Body
                    className={selected ? 'text-accent' : 'text-foreground'}
                  >
                    {artist.name}
                  </Body>
                  {selected ? (
                    <Mono className="text-accent">Current</Mono>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

export { CardArtistSheet };
