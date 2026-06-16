/**
 * Local cache of decrypted profile cards, keyed by Walrus blob id.
 *
 * Blob ids are content-addressed and immutable, so a cached card is valid until the
 * peer edits their profile (which produces a new blob id). This makes the
 * connections list render instantly on reopen — no Walrus fetch / Seal decrypt
 * unless the card actually changed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CachedCard {
  fullname?: string;
  avatar?: string;
  bio?: string;
}

const key = (blobId: string) => `pingou.card.${blobId}`;

export async function getCachedCard(blobId: string): Promise<CachedCard | null> {
  try {
    const raw = await AsyncStorage.getItem(key(blobId));
    return raw ? (JSON.parse(raw) as CachedCard) : null;
  } catch {
    return null;
  }
}

export async function setCachedCard(blobId: string, card: CachedCard): Promise<void> {
  try {
    await AsyncStorage.setItem(key(blobId), JSON.stringify(card));
  } catch {
    // cache is best-effort
  }
}
