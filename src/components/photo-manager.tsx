import { Image } from 'expo-image';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Body, Mono } from '@/components/ui/typography';
import {
  MAX_PHOTOS,
  deletePhoto,
  fetchSignedPhotos,
  listMyPhotos,
  pickPhotos,
  reorderPhotos,
  setPrimary,
  uploadPhoto,
  type Photo,
} from '@/lib/photos';

/**
 * Managing your own photos — shared by the onboarding step and the You tab.
 *
 * Your own photos are private too, so even here the tiles are rendered from
 * signed URLs fetched through `photo-url`. There is exactly one read path in
 * the app and this screen uses it like everyone else, rather than a second
 * privileged route that would need its own audit.
 *
 * Reordering is arrows rather than drag-and-drop: it needs no gesture library,
 * it works identically on web and native, and it is reachable rather than
 * being a gesture nobody discovers.
 */

type PhotoManagerProps = {
  /** Told the current count so a caller can gate its own "next" affordance. */
  onCountChange?: (count: number) => void;
};

type Tile = Photo & { url: string | null };

function PhotoManager({ onCountChange }: PhotoManagerProps) {
  const [tiles, setTiles] = React.useState<Tile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (isStale: () => boolean = () => false) => {
      const rows = await listMyPhotos();
      if (isStale()) return;
      if (!rows.ok) {
        setError(rows.error);
        setLoading(false);
        return;
      }

      // One signed-URL round trip for the whole set rather than one per tile.
      const signed = await fetchSignedPhotos(undefined, { all: true });
      if (isStale()) return;

      const urlById = new Map(
        signed.ok ? signed.value.map((s) => [s.id, s.url] as const) : [],
      );

      setTiles(rows.value.map((p) => ({ ...p, url: urlById.get(p.id) ?? null })));
      onCountChange?.(rows.value.length);
      setLoading(false);
    },
    [onCountChange],
  );

  React.useEffect(() => {
    // The cancellation guard is what makes a re-fetch on remount safe rather
    // than racing the previous one. Every setState inside `load` happens after
    // an await, so none of it runs synchronously with this effect — the lint
    // rule below only sees that `load` assigns state somewhere and cannot tell
    // that it is unreachable before the first suspension point.
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async: all state lands post-await
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const run = React.useCallback(
    async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      const result = await fn();
      if (!result.ok && result.error) setError(result.error);
      await load();
      setBusy(false);
    },
    [busy, load],
  );

  const handleAdd = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    const picked = await pickPhotos(MAX_PHOTOS - tiles.length);
    if (!picked.ok) {
      setError(picked.error);
      setBusy(false);
      return;
    }

    for (const uri of picked.value) {
      const uploaded = await uploadPhoto(uri);
      if (!uploaded.ok) {
        setError(uploaded.error);
        break;
      }
    }

    await load();
    setBusy(false);
  }, [busy, tiles.length, load]);

  const move = React.useCallback(
    (index: number, delta: number) => {
      const next = [...tiles];
      const target = index + delta;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      setTiles(next); // Optimistic — the order is the whole point of the tap.
      void run(async () => await reorderPhotos(next));
    },
    [tiles, run],
  );

  if (loading) {
    return (
      <View className="flex-row flex-wrap gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="aspect-[3/4] w-[31%] rounded-2xl" />
        ))}
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-3">
        {tiles.map((tile, index) => (
          <View key={tile.id} className="w-[31%] gap-1.5">
            <View className="aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-card">
              {tile.url ? (
                <Image
                  source={{ uri: tile.url }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View className="flex-1 items-center justify-center px-2">
                  <Mono className="text-center">Unavailable</Mono>
                </View>
              )}
            </View>

            {tile.isPrimary ? (
              <Mono className="text-accent">Main</Mono>
            ) : (
              <Pressable
                onPress={() => run(async () => await setPrimary(tile))}
                className="active:opacity-60"
              >
                <Mono>Set main</Mono>
              </Pressable>
            )}

            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => move(index, -1)}
                disabled={index === 0}
                hitSlop={6}
                className="active:opacity-60"
              >
                <Mono className={index === 0 ? 'opacity-30' : undefined}>←</Mono>
              </Pressable>
              <Pressable
                onPress={() => move(index, 1)}
                disabled={index === tiles.length - 1}
                hitSlop={6}
                className="active:opacity-60"
              >
                <Mono className={index === tiles.length - 1 ? 'opacity-30' : undefined}>→</Mono>
              </Pressable>
              <Pressable
                onPress={() => run(async () => await deletePhoto(tile))}
                hitSlop={6}
                className="ml-auto active:opacity-60"
              >
                <Mono>Remove</Mono>
              </Pressable>
            </View>
          </View>
        ))}

        {tiles.length < MAX_PHOTOS ? (
          <Pressable
            onPress={handleAdd}
            disabled={busy}
            className="aspect-[3/4] w-[31%] items-center justify-center rounded-2xl border border-dashed border-border active:opacity-70"
          >
            <Mono className="text-accent">{busy ? '…' : '+ Add'}</Mono>
          </Pressable>
        ) : null}
      </View>

      {tiles.length === 0 ? (
        <Body className="text-sm text-muted-foreground">
          No photos yet. They stay sealed until you match — nobody sees them before that.
        </Body>
      ) : null}

      {error ? <Body className="text-sm text-destructive">{error}</Body> : null}
    </View>
  );
}

export { PhotoManager };
