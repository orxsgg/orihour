import { createSupabaseBrowserClient } from './client';

export type MediaFolder = 'covers' | 'posters' | 'avatars' | 'audio';

function sanitizeFileSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'media';
}

export async function uploadMediaToSupabase(
  fileOrBlob: Blob | File,
  folder: MediaFolder,
  baseName: string,
  extension?: string
): Promise<string> {
  const supabase = createSupabaseBrowserClient();

  const inferredExt =
    extension ||
    (fileOrBlob instanceof File && fileOrBlob.name.includes('.')
      ? fileOrBlob.name.split('.').pop()?.toLowerCase()
      : fileOrBlob.type === 'image/png'
      ? 'png'
      : fileOrBlob.type === 'image/webp'
      ? 'webp'
      : fileOrBlob.type.startsWith('audio/')
      ? 'mp3'
      : 'jpg');

  const safeSlug = sanitizeFileSlug(baseName);
  const uniqueStamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `${folder}/${safeSlug}-${uniqueStamp}.${inferredExt || 'jpg'}`;

  const contentType =
    fileOrBlob.type ||
    (folder === 'audio' ? 'audio/mpeg' : 'image/jpeg');

  const { error } = await supabase.storage
    .from('orihour-media')
    .upload(path, fileOrBlob, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    throw new Error(`Gagal upload ke Supabase Storage: ${error.message}`);
  }

  const { data } = supabase.storage.from('orihour-media').getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error('Gagal mendapatkan URL publik media.');
  }

  return data.publicUrl;
}