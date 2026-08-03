import { AlbumArt } from '@/components/ui/album-art';

type AvatarProps = {
  /** Stable identity for the artwork — a user id. Falls back to the name. */
  seed?: string;
  name: string;
  size?: number;
  className?: string;
};

/**
 * A person's avatar: their sleeve, not their face.
 *
 * Thin wrapper over <AlbumArt> so every existing call site picks up the
 * generated artwork, and so changing the visual later stays a one-file edit.
 */
function Avatar({ seed, name, size = 64, className }: AvatarProps) {
  return <AlbumArt seed={seed ?? name} size={size} shape="circle" className={className} />;
}

export { Avatar };
export type { AvatarProps };
