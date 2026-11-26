'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Save,
  Upload,
  Trash2,
  CheckCircle2,
  CreditCard,
  Home,
  User,
} from 'lucide-react';
import { OwnerProfile, RoomConfig } from '@/types/orihour';
import { ProcessedImageResult } from '@/lib/imageProcessor';
import { uploadMediaToSupabase } from '@/lib/supabase/storage';
import ImageCropEnhanceModal from './ImageCropEnhanceModal';

interface RoomWalletTabProps {
  config: RoomConfig;
  onSaveSettings: (patch: {
    siteName: string;
    wallTitle: string;
    wallSubtitle: string;
    bio: string;
    ownerProfile: OwnerProfile;
  }) => Promise<void>;
}

export default function RoomWalletTab({
  config,
  onSaveSettings,
}: RoomWalletTabProps) {
  const [siteName, setSiteName] = useState(config.siteName);
  const [wallTitle, setWallTitle] = useState(config.wallTitle);
  const [wallSubtitle, setWallSubtitle] = useState(config.wallSubtitle);
  const [bio, setBio] = useState(config.bio);
  const [owner, setOwner] = useState<OwnerProfile>(config.ownerProfile);

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSiteName(config.siteName);
    setWallTitle(config.wallTitle);
    setWallSubtitle(config.wallSubtitle);
    setBio(config.bio);
    setOwner(config.ownerProfile);
  }, [config]);

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3200);
  };

  const handleConfirmAvatarCrop = async (result: ProcessedImageResult) => {
    setCropFile(null);
    setUploadingAvatar(true);
    try {
      const publicUrl = await uploadMediaToSupabase(
        result.blob,
        'avatars',
        owner.name || 'curator-avatar',
        'jpg'
      );
      setOwner((prev) => ({ ...prev, avatarUrl: publicUrl }));
      showToast('Foto profil Identity Card berhasil di-upload. Klik Simpan Perubahan.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengupload foto profil.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings({
        siteName: siteName.trim() || 'ORIHOUR',
        wallTitle: wallTitle.trim() || 'ORIHOUR',
        wallSubtitle: wallSubtitle.trim(),
        bio: bio.trim(),
        ownerProfile: owner,
      });
      showToast('Pengaturan ruangan & Identity Card dompet 3D berhasil disimpan.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {statusMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-700/25 bg-emerald-500/12 px-4 py-3 text-xs font-semibold text-emerald-950">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Room Plaque & Identity */}
      <section className="rounded-[24px] border border-[#E5D7C3] bg-[#FAF5EC]/85 p-6 shadow-sm backdrop-blur-xl">
        <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
          <Home className="h-3.5 w-3.5" />
          IDENTITAS RUANGAN &amp; PAPAN NAMA DINDING
        </p>
        <h2 className="mt-1 font-serif text-2xl text-[#241A13]">
          Plakat Dinding &amp; Deskripsi
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
              Judul Plakat Dinding 3D
            </span>
            <input
              type="text"
              value={wallTitle}
              onChange={(e) => setWallTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3.5 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
              Subjudul Plakat Dinding
            </span>
            <input
              type="text"
              value={wallSubtitle}
              onChange={(e) => setWallSubtitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3.5 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
              Bio Singkat (LO-FI Mode &amp; Tentang Ruangan)
            </span>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full resize-none rounded-xl border border-[#4A2E1B]/18 bg-white px-3.5 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
            />
          </label>
        </div>
      </section>

      {/* Leather Wallet Identity Card */}
      <section className="rounded-[24px] border border-[#E5D7C3] bg-[#FAF5EC]/85 p-6 shadow-sm backdrop-blur-xl">
        <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
          <CreditCard className="h-3.5 w-3.5" />
          DOMPET KULIT 3D · IDENTITY PASS
        </p>
        <h2 className="mt-1 font-serif text-2xl text-[#241A13]">
          Kartu Identitas &amp; Tautan Sosial
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Avatar Upload & Preview */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#4A2E1B]/12 bg-white/80 p-4 lg:col-span-4">
            <div className="flex h-44 w-36 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#9D8366] bg-[#3D2C24] shadow-md">
              {owner.avatarUrl ? (
                <img
                  src={owner.avatarUrl}
                  alt={owner.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-[#E5D5C0]/60" />
              )}
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) setCropFile(f);
              }}
            />

            <div className="mt-3.5 flex w-full items-center gap-2">
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4A2E1B] px-3 py-2 text-xs font-semibold text-[#FAF5EC] transition hover:bg-[#3A2213] disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingAvatar ? 'Upload...' : 'Upload & Crop Foto ID'}</span>
              </button>
              {owner.avatarUrl && (
                <button
                  type="button"
                  onClick={() => setOwner((prev) => ({ ...prev, avatarUrl: '' }))}
                  className="cursor-pointer rounded-xl border border-[#4A2E1B]/18 bg-white p-2 text-[#6B5442] hover:text-[#4A2E1B]"
                  title="Hapus foto profil"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Identity Fields */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:col-span-8">
            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Nama Lengkap
              </span>
              <input
                type="text"
                value={owner.name}
                onChange={(e) => setOwner({ ...owner, name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Peran / Role
              </span>
              <input
                type="text"
                value={owner.role}
                onChange={(e) => setOwner({ ...owner, role: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                ID Code
              </span>
              <input
                type="text"
                value={owner.idCode}
                onChange={(e) => setOwner({ ...owner, idCode: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 font-mono text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Lokasi
              </span>
              <input
                type="text"
                value={owner.location}
                onChange={(e) => setOwner({ ...owner, location: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Spotify Handle
              </span>
              <input
                type="text"
                value={owner.spotifyHandle}
                onChange={(e) => setOwner({ ...owner, spotifyHandle: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Spotify URL
              </span>
              <input
                type="url"
                value={owner.spotifyUrl}
                onChange={(e) => setOwner({ ...owner, spotifyUrl: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Instagram Handle
              </span>
              <input
                type="text"
                value={owner.instagramHandle}
                onChange={(e) => setOwner({ ...owner, instagramHandle: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Instagram URL
              </span>
              <input
                type="url"
                value={owner.instagramUrl}
                onChange={(e) => setOwner({ ...owner, instagramUrl: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
              />
            </label>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || uploadingAvatar}
          className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-[#4A2E1B] px-6 py-3 text-sm font-semibold text-[#FAF5EC] shadow-[0_14px_30px_-10px_rgba(74,46,27,0.48)] transition hover:bg-[#3A2213] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}</span>
        </button>
      </div>

      {/* Portrait ID Photo Crop, Rotate & Enhance Modal */}
      <ImageCropEnhanceModal
        file={cropFile}
        title="Crop & Rotate Foto Profil Identity Card"
        targetWidth={480}
        targetHeight={600}
        onCancel={() => setCropFile(null)}
        onConfirm={handleConfirmAvatarCrop}
      />
    </form>
  );
}