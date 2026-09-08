import Constants from 'expo-constants';

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://localhost:3000';

export const SYNC = {
  /** flush the outbox at most this often while online */
  minIntervalMs: 20_000,
  /** GPS trail sample interval while a trip is in progress */
  trailIntervalMs: 15_000,
  /** distance filter for trail points (metres) */
  trailDistanceM: 40,
  maxBatchPhotos: 40,
} as const;

export const PHOTO = {
  maxWidth: 1600,
  quality: 0.6,
} as const;
