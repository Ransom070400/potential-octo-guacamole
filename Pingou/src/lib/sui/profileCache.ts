/**
 * Local cache of decrypted profile cards, keyed by Walrus blob id.
 *
 * Blob ids are content-addressed and immutable, so a cached card is valid until the
 * peer edits their profile (which produces a new blob id). This makes the
 * connections list render instantly on reopen — no Walrus fetch / Seal decrypt
 * unless the card actually changed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PingouProfileData } from './profileStore';

export interface CachedCard {
  fullname?: string;
  avatar?: string;
  bio?: string;
}

const cardKey = (blobId: string) => `pingou.card.${blobId}`;
const profileKey = (blobId: string) => `pingou.profile.${blobId}`;

export async function getCachedCard(blobId: string): Promise<CachedCard | null> {
  try {
    const raw = await AsyncStorage.getItem(cardKey(blobId));
    return raw ? (JSON.parse(raw) as CachedCard) : null;
  } catch {
    return null;
  }
}

export async function setCachedCard(blobId: string, card: CachedCard): Promise<void> {
  try {
    await AsyncStorage.setItem(cardKey(blobId), JSON.stringify(card));
  } catch {
    // best-effort
  }
}

/** Full decrypted profile cache (for the user's own card) — keyed by blob id. */
export async function getCachedProfile(blobId: string): Promise<PingouProfileData | null> {
  try {
    const raw = await AsyncStorage.getItem(profileKey(blobId));
    return raw ? (JSON.parse(raw) as PingouProfileData) : null;
  } catch {
    return null;
  }
}

export async function setCachedProfile(blobId: string, data: PingouProfileData): Promise<void> {
  try {
    await AsyncStorage.setItem(profileKey(blobId), JSON.stringify(data));
  } catch {
    // best-effort
  }
}
