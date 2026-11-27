export const STORAGE_UPDATED_EVENT = 'orihour:storage-updated';

interface PresignResponse {
  accountId: string;
  accountName: string;
  provider: 'supabase' | 'b2';
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  didFailover?: boolean;
  failoverFromName?: string | null;
  projectedUsagePct?: number;
  nearLimitWarning?: boolean;
  error?: string;
}

function resolveMimeType(fileOrBlob: File | Blob, extension?: string): string {
  if (fileOrBlob.type && fileOrBlob.type.trim()) {
    return fileOrBlob.type;
  }

  const ext = (extension || '').toLowerCase().replace(/^\./, '');
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp3: 'audio/mpeg',
    mpeg: 'audio/mpeg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
  };

  return map[ext] || 'application/octet-stream';
}

function inferExtension(fileOrBlob: File | Blob, explicitExt?: string): string {
  if (explicitExt && explicitExt.trim()) {
    return explicitExt.trim().replace(/^\./, '').toLowerCase();
  }
  if (typeof File !== 'undefined' && fileOrBlob instanceof File) {
    const parts = fileOrBlob.name.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase();
    }
  }
  const mime = (fileOrBlob.type || '').toLowerCase();
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  return 'bin';
}

/**
 * Mengunggah media (cover, MP3, poster, avatar) melalui Multi-Storage Pool
 * (mendukung multi-akun Supabase Storage & Backblaze B2 Private dengan Auto-Failover).
 */
export async function uploadMediaToSupabase(
  fileOrBlob: File | Blob,
  folder: string,
  baseName: string,
  extension?: string
): Promise<string> {
  const ext = inferExtension(fileOrBlob, extension);
  const contentType = resolveMimeType(fileOrBlob, ext);
  const sizeBytes = fileOrBlob.size || 0;

  // 1. Minta Signed Upload URL dari server (server memilih akun aktif / auto-failover)
  const presignRes = await fetch('/api/admin/storage/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folder,
      baseName,
      extension: ext,
      contentType,
      sizeBytes,
    }),
  });

  const presignData = (await presignRes.json().catch(() => ({}))) as PresignResponse;

  if (!presignRes.ok || !presignData.uploadUrl || !presignData.publicUrl) {
    throw new Error(
      presignData.error ||
        'Gagal menyiapkan penyimpanan. Cek status kuota akun di tab Penyimpanan.'
    );
  }

  // 2. Upload langsung dari browser ke Supabase Storage / Backblaze B2 (lolos limit 4.5 MB Vercel)
  let uploadRes: Response;
  try {
    uploadRes = await fetch(presignData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: fileOrBlob,
    });
  } catch {
    const hint =
      presignData.provider === 'b2'
        ? ' Pastikan CORS Rules di bucket Backblaze B2 sudah mengizinkan S3 Compatible API ("Share everything in this bucket with every origin").'
        : ' Periksa koneksi internet atau status proyek Supabase tujuan.';
    throw new Error(`Upload ke "${presignData.accountName}" gagal terhubung.${hint}`);
  }

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    const hint =
      presignData.provider === 'b2'
        ? ' Cek izin Application Key (Read and Write), nama bucket, dan CORS Rules pada bucket Backblaze B2.'
        : ' Cek apakah bucket sudah dibuat (public) dan kuota akun masih tersedia.';
    throw new Error(
      `Gagal mengunggah ke "${presignData.accountName}" (HTTP ${uploadRes.status}).${hint}${
        errText ? ` [${errText.slice(0, 120)}]` : ''
      }`
    );
  }

  // 3. Laporkan ukuran file ke database utama agar progress bar kuota langsung ter-update
  await fetch('/api/admin/storage/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: presignData.accountId,
      sizeBytes,
    }),
  }).catch(() => {});

  // Beritahu header Panel Admin untuk langsung menyegarkan banner peringatan kapasitas
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(STORAGE_UPDATED_EVENT, {
        detail: {
          accountId: presignData.accountId,
          accountName: presignData.accountName,
          didFailover: Boolean(presignData.didFailover),
          failoverFromName: presignData.failoverFromName || null,
          nearLimitWarning: Boolean(presignData.nearLimitWarning),
        },
      })
    );
  }

  return presignData.publicUrl;
}