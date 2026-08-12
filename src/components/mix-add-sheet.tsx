import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import * as React from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

import { Body, Mono } from '@/components/ui/typography';
import {
  addMixTrack,
  searchTracks,
  type MixTrack,
  type Track,
} from '@/lib/mix';
import { getMe } from '@/lib/seed';
import { THEME } from '@/lib/theme';

export type MixAddSheetHandle = { present: () => void };

type MixAddSheetProps = {
  /** Null in local mode — nothing to add a track to. */
  matchId: string | null;
  onAdded: (track: MixTrack) => void;
};

/** Long enough that typing a title does not fire a request per keystroke. */
const DEBOUNCE_MS = 350;

/**
 * `BottomSheetTextInput` reaches into RN internals that react-native-web does
 * not implement (`TextInput.State.currentlyFocusedInput`), so rendering it on
 * web throws outright. Its only job is keyboard handling inside a sheet, which
 * web does not need — so web gets the plain input and native keeps the one
 * that knows how to move out of the keyboard's way.
 */
const SheetInput = Platform.OS === 'web' ? TextInput : BottomSheetTextInput;

/**
 * Adding a song to the Mix, from anywhere rather than only from a chat message.
 *
 * Two sources, in the order they are useful: whatever you search for, and —
 * before you have typed anything, or if search is unavailable — your own top
 * tracks, which is the list the app offered before search existed. That
 * fallback is why a missing `LASTFM_API_KEY` degrades to the old behaviour
 * instead of an empty sheet.
 */
const MixAddSheet = React.forwardRef<MixAddSheetHandle, MixAddSheetProps>(
  function MixAddSheet({ matchId, onAdded }, ref) {
    const sheetRef = React.useRef<BottomSheetModal>(null);
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<Track[] | null>(null);
    const [searching, setSearching] = React.useState(false);
    const [adding, setAdding] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
    }));

    React.useEffect(() => {
      const q = query.trim();
      if (q.length < 2) {
        setResults(null);
        setSearching(false);
        return;
      }

      setSearching(true);
      const timer = setTimeout(async () => {
        const found = await searchTracks(q);
        setResults(found);
        setSearching(false);
      }, DEBOUNCE_MS);

      return () => clearTimeout(timer);
    }, [query]);

    const add = async (track: Track) => {
      if (!matchId || adding) return;
      const key = `${track.title}::${track.artist}`;
      setAdding(key);
      setError(null);

      const saved = await addMixTrack(matchId, track);
      setAdding(null);

      if (!saved) {
        setError('That did not land. Try again.');
        return;
      }
      onAdded(saved);
      setQuery('');
      sheetRef.current?.dismiss();
    };

    // Before a search, offer what we already know you play.
    const fallback = getMe().topTracks;
    const showing: Track[] = results ?? fallback;
    const isFallback = results === null;

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['75%']}
        backgroundStyle={{ backgroundColor: THEME.dark.card }}
        handleIndicatorStyle={{ backgroundColor: THEME.dark.mutedForeground }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
          />
        )}
      >
        <BottomSheetScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <Mono>Add to the Mix</Mono>

          <SheetInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a song…"
            placeholderTextColor={THEME.dark.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: THEME.dark.border,
              backgroundColor: THEME.dark.background,
              paddingHorizontal: 16,
              paddingVertical: 12,
              color: THEME.dark.foreground,
              fontSize: 16,
            }}
          />

          <Mono>
            {searching
              ? 'Looking…'
              : isFallback
                ? 'Your top tracks'
                : showing.length > 0
                  ? `${showing.length} results`
                  : 'Nothing matched that'}
          </Mono>

          {showing.map((track) => {
            const key = `${track.title}::${track.artist}`;
            return (
              <Pressable
                key={key}
                onPress={() => add(track)}
                disabled={adding !== null || !matchId}
                className="rounded-xl border border-border bg-background px-4 py-3 active:opacity-70"
              >
                <Body numberOfLines={1}>{track.title}</Body>
                <Mono>{adding === key ? 'Adding…' : track.artist}</Mono>
              </Pressable>
            );
          })}

          {!isFallback && showing.length === 0 && !searching ? (
            <Body className="text-sm text-muted-foreground">
              Nothing under that name — try the artist instead.
            </Body>
          ) : null}

          {error ? (
            <Body className="text-sm text-destructive">{error}</Body>
          ) : null}

          <View className="h-6" />
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

export { MixAddSheet };
