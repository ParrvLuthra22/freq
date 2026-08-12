import { Image } from 'expo-image';
import * as React from 'react';
import { View } from 'react-native';

import { AlbumArt } from '@/components/ui/album-art';

/**
 * A track's real cover if Last.fm has one, and the procedural sleeve if not.
 *
 * The fallback is not a degraded state — most of what this app is about is
 * artists too obscure for a cover to exist, so `AlbumArt` is the common case
 * rather than the error case, and the two are sized identically so a grid does
 * not reflow depending on which one lands.
 *
 * Deliberately not used for the sealed discovery card: a person's avatar there
 * is their own generated sleeve, which is the signature mechanic, not a
 * placeholder waiting to be replaced by somebody else's JPEG.
 */

type TrackArtProps = {
  title: string;
  artist: string;
  /** Resolved cover URL, or undefined while unknown/absent. */
  url?: string;
  size?: number;
  shape?: 'circle' | 'square';
  /** Fill the container's width, staying square — mirrors `AlbumArt`'s prop. */
  fill?: boolean;
};

function TrackArt({
  title,
  artist,
  url,
  size,
  shape = 'square',
  fill,
}: TrackArtProps) {
  // A URL that 404s or is blocked would otherwise leave a hole where the
  // artwork should be; falling back on error keeps the tile whole.
  //
  // Remembering *which* url failed rather than a boolean means a new url
  // recovers on its own — no effect resetting a flag, and no window where the
  // component still considers a fresh cover broken because the last one was.
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const failed = url !== undefined && failedUrl === url;

  const seed = `${title}-${artist}`;
  if (!url || failed) {
    return <AlbumArt seed={seed} size={size} shape={shape} fill={fill} />;
  }

  const radius = shape === 'circle' ? 9999 : 12;

  // `fill` mode has no intrinsic size, so the square comes from aspectRatio
  // rather than from a height the parent has not set.
  return (
    <View
      style={
        fill
          ? {
              width: '100%',
              aspectRatio: 1,
              borderRadius: radius,
              overflow: 'hidden',
            }
          : {
              width: size,
              height: size,
              borderRadius: radius,
              overflow: 'hidden',
            }
      }
    >
      <Image
        source={{ uri: url }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        transition={200}
        onError={() => setFailedUrl(url)}
      />
    </View>
  );
}

export { TrackArt };
export type { TrackArtProps };
