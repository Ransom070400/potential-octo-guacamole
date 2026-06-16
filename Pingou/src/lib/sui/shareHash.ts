/**
 * Share-code hashing, isolated from share.ts because it pulls expo-crypto (which
 * drags in react-native and so can't be imported under Node for the headless smoke
 * tests). profileService lazy-imports this only on the profile-create path.
 */
import * as Crypto from 'expo-crypto';
import { fromBase64 } from '@mysten/sui/utils';

/** sha256(utf8(code)) as bytes — matches Move's `hash::sha2_256(code)`. */
export async function shareCodeHash(code: string): Promise<Uint8Array> {
  const b64 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, code, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return fromBase64(b64);
}
