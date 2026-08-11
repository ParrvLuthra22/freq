import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { getMyProfileId } from '@/lib/remote-profiles';
import { supabase } from '@/lib/supabase';

/**
 * Profile photos.
 *
 * The privacy model lives in the backend, not here: the `profile-photos`
 * bucket is private and has no read policy, so nothing in this file can fetch
 * a photo directly. Every read goes through `photo-url`, which mints a
 * short-lived signed URL only after verifying a mutual match. This module's
 * job is the other half — picking, shrinking, uploading, and ordering your own
 * photos, all of which are owner-scoped writes the storage policies allow.
 */

export const MAX_PHOTOS = 6;

/** Matches the bucket's own `file_size_limit`, so the client fails first with a kinder message. */
const MAX_BYTES = 5 * 1024 * 1024;

/** Long edge, in pixels. A dating-app photo never needs to be a 12-megapixel original. */
const MAX_EDGE = 1200;
const JPEG_QUALITY = 0.8;

const BUCKET = 'profile-photos';
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export type Photo = {
  id: string;
  path: string;
  position: number;
  isPrimary: boolean;
};

/** A photo you are allowed to look at, with a URL that stops working shortly. */
export type SignedPhoto = {
  id: string;
  url: string;
  isPrimary: boolean;
  position: number;
};

export type PhotoResult<T> = { ok: true; value: T } | { ok: false; error: string };

function fail(error: string): PhotoResult<never> {
  return { ok: false, error };
}

/**
 * Ask for photos from the library.
 *
 * Works on web without a special case: expo-image-picker renders a file input
 * there, which is why the file-input path needs no separate implementation.
 * Permissions are a no-op on web and a real prompt on a device.
 */
export async function pickPhotos(remainingSlots: number): Promise<PhotoResult<string[]>> {
  if (remainingSlots <= 0) {
    return fail(`That's the lot — ${MAX_PHOTOS} photos is the maximum.`);
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return fail('We need access to your library to add a photo.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: remainingSlots > 1,
    selectionLimit: remainingSlots,
    quality: 1,
    // The originals get resized below, so there is no reason to also let the
    // picker's own editor crop them.
    allowsEditing: false,
  });

  if (result.canceled) return { ok: true, value: [] };

  for (const asset of result.assets) {
    if (asset.mimeType && !ALLOWED.includes(asset.mimeType)) {
      return fail('That file type won’t work — JPEG, PNG or WebP only.');
    }
    // Checked before compression: a 40MB original is worth refusing early
    // rather than spending time shrinking.
    if (asset.fileSize && asset.fileSize > MAX_BYTES * 8) {
      return fail('That photo is enormous — try one under 40MB.');
    }
  }

  return { ok: true, value: result.assets.map((a) => a.uri) };
}

/**
 * Shrink and re-encode before upload.
 *
 * Always JPEG: it keeps the bucket's MIME allow-list small, strips whatever
 * the source format carried, and is the one format every platform here can
 * both produce and display.
 */
async function compress(uri: string): Promise<string> {
  const { uri: out } = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_EDGE } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return out;
}

/**
 * Read a local file into bytes.
 *
 * `fetch` on a local uri works on both web (blob:/data:) and native (file:),
 * which avoids branching on platform for what is really one operation.
 */
async function toBytes(uri: string): Promise<ArrayBuffer> {
  const res = await fetch(uri);
  return await res.arrayBuffer();
}

export async function uploadPhoto(uri: string): Promise<PhotoResult<Photo>> {
  if (!supabase) return fail('Photos need a live account, not local mode.');

  const profileId = getMyProfileId();
  if (!profileId) return fail('Your profile is still syncing — try again in a moment.');

  const existing = await listMyPhotos();
  if (existing.ok && existing.value.length >= MAX_PHOTOS) {
    return fail(`That's the lot — ${MAX_PHOTOS} photos is the maximum.`);
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await toBytes(await compress(uri));
  } catch {
    return fail('That photo would not open. Try a different one.');
  }

  if (bytes.byteLength > MAX_BYTES) {
    return fail('Still too large after compressing — try a smaller photo.');
  }

  // The first path segment is the owner's profile id, which is exactly what
  // the storage policies check. Anything else here would be rejected.
  const path = `${profileId}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) return fail('That upload did not land. Try again.');

  const isFirst = existing.ok && existing.value.length === 0;
  const position = existing.ok ? existing.value.length : 0;

  const { data, error } = await supabase
    .from('profile_photos')
    .insert({ profile_id: profileId, path, position, is_primary: isFirst })
    .select('id, path, position, is_primary')
    .single();

  if (error || !data) {
    // The object is already up but unreferenced — clean it up rather than
    // leaving an orphan nobody can see or delete through the UI.
    await supabase.storage.from(BUCKET).remove([path]);
    return fail('We saved the photo but could not attach it. Try again.');
  }

  return {
    ok: true,
    value: { id: data.id, path: data.path, position: data.position, isPrimary: data.is_primary },
  };
}

export async function listMyPhotos(): Promise<PhotoResult<Photo[]>> {
  if (!supabase) return fail('Photos need a live account, not local mode.');
  const profileId = getMyProfileId();
  if (!profileId) return { ok: true, value: [] };

  const { data, error } = await supabase
    .from('profile_photos')
    .select('id, path, position, is_primary')
    .eq('profile_id', profileId)
    .order('position', { ascending: true });

  if (error) return fail('Could not load your photos.');
  return {
    ok: true,
    value: (data ?? []).map((r) => ({
      id: r.id,
      path: r.path,
      position: r.position,
      isPrimary: r.is_primary,
    })),
  };
}

export async function deletePhoto(photo: Photo): Promise<PhotoResult<null>> {
  if (!supabase) return fail('Photos need a live account, not local mode.');

  const { error } = await supabase.from('profile_photos').delete().eq('id', photo.id);
  if (error) return fail('Could not remove that photo.');

  // Best-effort: the row is what the app reads, so a stranded object is
  // invisible rather than harmful, and the row delete is the one that matters.
  await supabase.storage.from(BUCKET).remove([photo.path]);

  // Deleting the primary leaves nobody unsealed at a match, so promote the
  // next one rather than leaving the profile without a face.
  if (photo.isPrimary) {
    const rest = await listMyPhotos();
    if (rest.ok && rest.value.length > 0) await setPrimary(rest.value[0]);
  }

  return { ok: true, value: null };
}

export async function setPrimary(photo: Photo): Promise<PhotoResult<null>> {
  if (!supabase) return fail('Photos need a live account, not local mode.');
  const profileId = getMyProfileId();
  if (!profileId) return fail('Your profile is still syncing — try again in a moment.');

  // Clear first: there is a unique index allowing only one primary per
  // profile, so setting the new one before clearing the old would collide.
  const { error: clearError } = await supabase
    .from('profile_photos')
    .update({ is_primary: false })
    .eq('profile_id', profileId)
    .eq('is_primary', true);
  if (clearError) return fail('Could not update your main photo.');

  const { error } = await supabase
    .from('profile_photos')
    .update({ is_primary: true })
    .eq('id', photo.id);
  if (error) return fail('Could not update your main photo.');

  return { ok: true, value: null };
}

/** Persist a new order. Positions are rewritten to match the array exactly. */
export async function reorderPhotos(photos: Photo[]): Promise<PhotoResult<null>> {
  if (!supabase) return fail('Photos need a live account, not local mode.');

  const updates = photos.map((photo, index) =>
    supabase!.from('profile_photos').update({ position: index }).eq('id', photo.id),
  );
  const results = await Promise.all(updates);
  if (results.some((r) => r.error)) return fail('Could not save that order.');

  return { ok: true, value: null };
}

/**
 * The only read path.
 *
 * `slug` omitted means your own photos. For anyone else, `photo-url` refuses
 * unless the two of you are mutually matched — this call is what the reveal
 * screen makes, and it is expected to fail everywhere before that.
 */
export async function fetchSignedPhotos(
  slug?: string,
  opts?: { all?: boolean },
): Promise<PhotoResult<SignedPhoto[]>> {
  if (!supabase) return fail('Photos need a live account, not local mode.');

  const { data, error } = await supabase.functions.invoke('photo-url', {
    body: { slug, all: opts?.all ?? false },
  });

  if (error) {
    // A 403 here is the product working, not an outage: their face is still
    // sealed. Anything else is a genuine failure.
    const context = (error as { context?: Response })?.context;
    if (context?.status === 403) return fail('Their face is sealed until you both swipe.');
    return fail('Could not load photos right now.');
  }
  if (data?.error) return fail(String(data.error));

  return { ok: true, value: (data?.photos ?? []) as SignedPhoto[] };
}
