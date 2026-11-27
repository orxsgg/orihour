export type WeatherType = 'CLEAR' | 'CLOUDY' | 'RAIN' | 'BREEZY';

export type ReleaseType = 'Song' | 'Album' | 'Single' | 'EP' | 'Live Version' | 'Cover';

export const RELEASE_TYPES: ReleaseType[] = [
  'Song',
  'Album',
  'Single',
  'EP',
  'Live Version',
  'Cover',
];

export type ClipMode = 'full' | 'trimmed' | 'snippet';

export interface TrackItem {
  id: string;
  title: string;
  duration: string;
  audioUrl?: string;
  clipMode?: ClipMode;
  clipStartSec?: number;
  clipEndSec?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
}

export interface GenreItem {
  id: string;
  name: string;
}

export type CameraFocusTarget =
  | 'ENTRY'
  | 'ROOM'
  | 'DESK'
  | 'TURNTABLE'
  | 'CRATE'
  | 'NOTES'
  | 'WINDOW'
  | 'CLOCK'
  | 'PINBOARD'
  | 'WALLET';

export interface VinylRecord {
  id: string;
  title: string;
  artist: string;
  album: string;
  releaseType: ReleaseType;
  releaseYear: number;
  duration: string;
  genre: string;
  /** Legacy alias kept synced with genre for backward compatibility */
  mood: string;
  labelColor: string;
  artStyle: number;
  coverUrl?: string;
  /** Draw title, artist & year typography over the cover image */
  showCoverOverlay?: boolean;
  audioUrl?: string;
  /** Full song, trimmed edges (no visitor tag), or partial snippet playback */
  clipMode?: ClipMode;
  clipStartSec?: number;
  clipEndSec?: number;
  /** Smooth fade-in and fade-out durations in seconds */
  fadeInSec?: number;
  fadeOutSec?: number;
  /** Used when releaseType === 'Song' */
  favoriteLyric: string;
  /** Used when releaseType !== 'Song' (Album, EP, Single, Live Version, Cover) */
  favoriteSong?: string;
  /** Tracklist for Album, EP, Single, Live Version, Cover */
  tracks?: TrackItem[];
  linerNotes: string;
  likesCount: number;
  /** 1..6 if displayed inside the 3D wooden rack container, null if archive-only */
  rackSlot: number | null;
  createdAt?: string;
}

export interface PosterItem {
  id: string;
  slotIndex?: number;
  title: string;
  subtitle: string;
  accentColor: string;
  style: number;
  imageUrl?: string;
}

export interface OwnerProfile {
  name: string;
  role: string;
  idCode: string;
  location: string;
  avatarUrl?: string;
  spotifyHandle: string;
  spotifyUrl: string;
  instagramHandle: string;
  instagramUrl: string;
}

export interface RoomConfig {
  siteName: string;
  wallTitle: string;
  wallSubtitle: string;
  bio: string;
  /** Null means the 3D turntable platter & right cover stand are intentionally empty */
  activeTurntableVinylId: string | null;
  ownerProfile: OwnerProfile;
  posters: PosterItem[];
}

export interface GuestbookPostcard {
  id: string;
  songTitle: string;
  artist: string;
  senderName: string;
  reason: string;
  dateLabel: string;
  pinColor: string;
  /** Admin can pin & manually arrange postcards so newer messages won't push them off */
  isPinned?: boolean;
  pinOrder?: number | null;
  isHidden?: boolean;
  createdAt?: string;
}

export const POSTCARD_LIMITS = {
  songTitle: 34,
  artist: 30,
  senderName: 18,
  reason: 110,
} as const;

export const MAX_PINBOARD_VISIBLE = 6;

export interface VisitorLogItem {
  id: string;
  sessionId: string;
  path: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  timezone: string;
  deviceType: string;
  browser: string;
  os: string;
  referrer: string;
  viewMode: string;
  weather: string;
  screenSize: string;
  createdAt: string;
}

export interface AnalyticsBucket {
  name: string;
  sublabel?: string;
  code?: string;
  count: number;
  pct: number;
}

export interface AnalyticsDailyPoint {
  date: string;
  label: string;
  visits: number;
  uniqueVisitors: number;
}

export interface AnalyticsDashboardData {
  tableMissing?: boolean;
  rangeDays: number;
  summary: {
    totalVisits: number;
    uniqueVisitors: number;
    todayVisits: number;
    last7DaysVisits: number;
    topLocation: string;
    mobileSharePct: number;
  };
  dailySeries: AnalyticsDailyPoint[];
  byCity: AnalyticsBucket[];
  byCountry: AnalyticsBucket[];
  byDevice: AnalyticsBucket[];
  byBrowser: AnalyticsBucket[];
  byOs: AnalyticsBucket[];
  byReferrer: AnalyticsBucket[];
  byViewMode: AnalyticsBucket[];
  recentLogs: VisitorLogItem[];
}