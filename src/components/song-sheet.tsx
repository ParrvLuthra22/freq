import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as React from 'react';
import { Pressable } from 'react-native';

import { sendMessage, type StoredMessage } from '@/lib/chat';
import { getMe } from '@/lib/seed';
import { Body, Mono } from '@/components/ui/typography';

export type SongSheetHandle = { present: () => void };

type SongSheetProps = {
  /** Null in local mode — nothing to sync a sent song through. */
  matchId: string | null;
  onSent: (message: StoredMessage) => void;
};

/**
 * The 🎵 button's picker. There is no music search or playback integration in
 * this app (mock-first, no Spotify SDK until M6) — sending a song means
 * picking one of your own already-known top tracks, same source `swapPicks`
 * draws from for Blind Swap, just the general list rather than a curated one.
 */
const SongSheet = React.forwardRef<SongSheetHandle, SongSheetProps>(
  function SongSheet({ matchId, onSent }, ref) {
    const sheetRef = React.useRef<BottomSheetModal>(null);
    const [sending, setSending] = React.useState<string | null>(null);

    React.useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
    }));

    const send = async (title: string, artist: string) => {
      if (!matchId || sending) return;
      const key = `${title}::${artist}`;
      setSending(key);
      const message = await sendMessage(matchId, 'song', { title, artist });
      setSending(null);
      sheetRef.current?.dismiss();
      if (message) onSent(message);
    };

    const topTracks = getMe().topTracks;

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['45%']}
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
        <BottomSheetView className="gap-2 px-5 pb-8 pt-2">
          <Mono className="px-1">Send a song</Mono>
          {topTracks.map((t) => {
            const key = `${t.title}::${t.artist}`;
            return (
              <Pressable
                key={key}
                onPress={() => send(t.title, t.artist)}
                disabled={sending !== null}
                className="rounded-xl border border-border px-3.5 py-2.5 active:opacity-70"
              >
                <Body className="text-sm">
                  {t.title} — {t.artist}
                </Body>
                {sending === key ? (
                  <Mono className="text-accent">Sending…</Mono>
                ) : null}
              </Pressable>
            );
          })}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

export { SongSheet };
